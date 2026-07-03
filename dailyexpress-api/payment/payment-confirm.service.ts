import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, payment } from "../db/index";
import { logger } from "../utils/logger";
import { jobService } from "../workers/job.service";
import { koraClient } from "./kora.client";
import { PaymentRepository } from "./payment.repository";
import { PaymentRefundService } from "./payment-refund.service";
import type { PayoutService } from "../payout/payout.service";
import type { KoraVerifyResponse } from "./payment.types";

export class PaymentConfirmService {
  private readonly kora = koraClient;

  constructor(
    private repo: PaymentRepository,
    private payoutService: PayoutService,
  ) {}

  async confirmPayment(
    reference: string,
    verificationData: KoraVerifyResponse,
    rawResponse: unknown,
  ) {
    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      logger.info("payment.confirm_already_claimed", { reference });
      return;
    }

    const verification = await this.kora.verifyTransaction(reference);
    if (verification.data.status.toLowerCase() !== "success") {
      await this.repo.updateProcessingPayment(reference, "failed", {
        failureCode: "VERIFICATION_MISMATCH",
        failureReason: `Confirm verification returned ${verification.data.status}`,
        providerStatus: verification.data.status,
      });
      return;
    }

    let bookingExpired = true;
    if (claimed.bookingId) {
      const bookingRecord = await db.query.booking.findFirst({
        where: eq(booking.id, claimed.bookingId),
        columns: { expiresAt: true },
      });
      bookingExpired = !bookingRecord?.expiresAt || bookingRecord.expiresAt.getTime() <= Date.now();
    }

    if (bookingExpired) {
      await this.repo.updateProcessingPayment(reference, "expired", {
        failureCode: "BOOKING_EXPIRED",
        failureReason: "Payment confirmed after booking hold expired",
        providerStatus: "success",
      });

      const refundService = new PaymentRefundService(this.repo);
      await refundService.refundPayment(
        reference,
        verification.data,
        rawResponse,
        "Payment completed after booking hold expired",
      );
      return;
    }

    await db.transaction(async (tx) => {
      await tx.update(payment)
        .set({ status: "successful", paidAt: new Date(), providerStatus: "success", lastStatusCheckAt: new Date(), updatedAt: new Date() })
        .where(and(eq(payment.reference, reference), eq(payment.status, "processing")));

      await jobService.enqueue(tx, "allocation.process", {
        bookingId: claimed.bookingId,
        reference,
      });
    });
  }
}
