import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, payment, type PaymentRecord } from "../db/index";
import { logger } from "../utils/logger";
import { jobService } from "../workers/job.service";
import { koraClient } from "./kora.client";
import { PaymentRefundService, paymentRefundService } from "./payment-refund.service";
import { PaymentRepository, paymentRepository } from "./payment.repository";
import type { PaymentStatus } from "./payment.types";

const ZOMBIE_THRESHOLD_MS = 1000 * 60 * 30;
const BATCH_SIZE = 50;

export interface SweepResult {
  scanned: number;
  reconciled: number;
  stillPending: number;
  koraErrors: number;
  koraNotFound: number;
}
export class PaymentZombieSweeperService {
  private readonly kora = koraClient;

  constructor(
    private repo: PaymentRepository,
    private refundService: PaymentRefundService,
  ) {}

  async sweep(): Promise<SweepResult> {
    const result: SweepResult = { scanned: 0, reconciled: 0, stillPending: 0, koraErrors: 0, koraNotFound: 0 };

    const cutoff = new Date(Date.now() - ZOMBIE_THRESHOLD_MS);

    const zombies = await db
      .select()
      .from(payment)
      .where(and(eq(payment.status, "processing"), lt(payment.updatedAt, cutoff)))
      .limit(BATCH_SIZE);

    result.scanned = zombies.length;

    for (const p of zombies) {
      await this.reconcile(p, result);
    }

    logger.info("payment.zombie_sweep.completed", {
      scanned: result.scanned,
      reconciled: result.reconciled,
      stillPending: result.stillPending,
      koraErrors: result.koraErrors,
      koraNotFound: result.koraNotFound,
    });
    return result;
  }

  private async reconcile(p: PaymentRecord, result: SweepResult) {
    let verification: { data: { status: string; amount: number | string; currency: string; paid_at?: string | null; payment_reference?: string | null; reference: string }; raw: unknown };

    try {
      verification = await this.kora.verifyTransaction(p.reference);
    } catch (err: unknown) {
      const httpStatus = (err as any)?.koraHttpStatus;
      if (httpStatus === 404) {
        await this.handleNotFound(p);
        result.koraNotFound++;
        return;
      }
      await this.handleKoraError(p, err);
      result.koraErrors++;
      return;
    }

    const koraStatus = verification.data.status.toLowerCase();

    switch (koraStatus) {
      case "success":
        await this.handleKoraSuccess(p, verification);
        result.reconciled++;
        break;
      case "failed":
        await this.handleKoraFailed(p);
        result.reconciled++;
        break;
      default:
        await this.updateLastStatusCheck(p);
        result.stillPending++;
        break;
    }
  }

  private async handleKoraSuccess(
    p: PaymentRecord,
    verification: { data: { status: string; amount: number | string; currency: string; paid_at?: string | null; payment_reference?: string | null; reference: string }; raw: unknown },
  ) {
    let bookingExpired = true;
    if (p.bookingId) {
      const bookingRecord = await db.query.booking.findFirst({
        where: eq(booking.id, p.bookingId),
        columns: { expiresAt: true },
      });
      bookingExpired = !bookingRecord?.expiresAt || bookingRecord.expiresAt.getTime() <= Date.now();
    }

    if (bookingExpired) {
      const [updated] = await this.repo.updateProcessingPayment(p.reference, "expired" as PaymentStatus, {
        failureCode: "BOOKING_EXPIRED",
        failureReason: "Payment completed after booking hold expired (zombie sweep)",
        providerStatus: "success",
      });

      if (!updated) {
        logger.info("payment.zombie_sweep.race_lost", { reference: p.reference, action: "expire" });
        return;
      }

      try {
        await this.refundService.refundPayment(
          p.reference,
          {
            amount: verification.data.amount,
            currency: verification.data.currency,
            paid_at: verification.data.paid_at,
            payment_reference: verification.data.payment_reference,
            reference: verification.data.reference,
            status: verification.data.status,
          },
          verification.raw,
          "Payment completed after booking hold expired (zombie sweep)",
        );
      } catch (refundErr: unknown) {
        logger.error("payment.zombie_sweep.refund_failed", {
          reference: p.reference,
          error: refundErr instanceof Error ? refundErr.message : String(refundErr),
        });
      }
      return;
    }

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(payment)
        .set({
          status: "successful",
          paidAt: new Date(),
          providerStatus: "success",
          lastStatusCheckAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(payment.reference, p.reference), eq(payment.status, "processing")))
        .returning({ id: payment.id });

      if (!updated) {
        logger.info("payment.zombie_sweep.race_lost", { reference: p.reference, action: "complete" });
        return;
      }

      if (p.bookingId) {
        await jobService.enqueue(tx, "allocation.process", {
          bookingId: p.bookingId,
          reference: p.reference,
        });
      }
    });
  }

  private async handleKoraFailed(p: PaymentRecord) {
    const [updated] = await this.repo.updateProcessingPayment(p.reference, "failed" as PaymentStatus, {
      failureCode: "ZOMBIE_FAILED",
      failureReason: "Payment reported as failed by provider during zombie sweep",
      providerStatus: "failed",
    });

    if (!updated) {
      logger.info("payment.zombie_sweep.race_lost", { reference: p.reference, action: "fail" });
    }
  }

  private async handleNotFound(p: PaymentRecord) {
    const [updated] = await this.repo.updateProcessingPayment(p.reference, "expired" as PaymentStatus, {
      failureCode: "ZOMBIE_NOT_FOUND",
      failureReason: "Payment reference not found at provider during zombie sweep",
      providerStatus: "not_found",
    });

    if (!updated) {
      logger.info("payment.zombie_sweep.race_lost", { reference: p.reference, action: "not_found" });
      return;
    }

    if (p.bookingId) {
      await db
        .update(booking)
        .set({
          status: "cancelled",
          paymentStatus: "expired" as PaymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(booking.id, p.bookingId));
    }
  }

  private async handleKoraError(p: PaymentRecord, err: unknown) {
    logger.warn("payment.zombie_sweep.kora_error", {
      reference: p.reference,
      error: err instanceof Error ? err.message : String(err),
    });

    await this.updateLastStatusCheck(p);
  }

  private async updateLastStatusCheck(p: PaymentRecord) {
    await db
      .update(payment)
      .set({ lastStatusCheckAt: new Date(), updatedAt: new Date() })
      .where(and(eq(payment.reference, p.reference), eq(payment.status, "processing")));
  }
}

export const paymentZombieSweeperService = new PaymentZombieSweeperService(paymentRepository, paymentRefundService);
