import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { earning, payoutAttempt, payout as payoutTable } from "../db/index";
import { KoraClient } from "../payment/kora.client";
import { PayoutRepository } from "./payout.repository";
import { DriverService } from "../driver/driverService";
import { NotificationService } from "../notification/notificationService";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { parseMajorCurrencyToMinor, formatAmountMinor } from "../utils/payout";
import type { KoraPayoutHistoryItem } from "../payment/payment.types";
import type { DriverNotification } from "@shared/types";

type PayoutTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PayoutRecord = typeof payoutTable.$inferSelect;
type PayoutAttemptRecord = typeof payoutAttempt.$inferSelect;

export type AttemptVerificationOutcome =
  | "settled"
  | "failed"
  | "processing"
  | "unknown";

export class PayoutAttemptService {
  private readonly kora = new KoraClient();
  private readonly driverService = new DriverService();
  private readonly notificationService = new NotificationService();

  constructor(private repo: PayoutRepository) {}

  async checkWithProvider(
    payout: PayoutRecord,
    attempt: PayoutAttemptRecord,
  ): Promise<AttemptVerificationOutcome> {
    try {
      const verification = await this.kora.findPayoutByReference(
        attempt.koraReference,
      );
      const verifiedPayout = verification.data as KoraPayoutHistoryItem | null;

      if (!verifiedPayout) {
        await this.markPendingVerification(
          attempt.id,
          "Payout verification pending",
          verification.raw,
        );
        return "unknown";
      }

      const providerStatus = verifiedPayout.status.toLowerCase();
      if (providerStatus === "success") {
        await this.settleAttempt(
          payout,
          attempt,
          verification.raw,
          parseMajorCurrencyToMinor(verifiedPayout.fee || 0),
        );
        return "settled";
      }

      if (providerStatus === "failed") {
        await this.repo.updatePayoutAttempt(attempt.id, {
          status: "failed",
          failureReason:
            verifiedPayout.message ||
            attempt.failureReason ||
            "Transfer failed",
          rawWebhook: verification.raw,
        });
        return "failed";
      }

      if (providerStatus === "processing" || providerStatus === "pending") {
        await this.markPendingVerification(
          attempt.id,
          "Awaiting payout confirmation",
          verification.raw,
        );
        await db
          .update(payoutTable)
          .set({
            status: "processing",
            nextRetryAt: null,
            failureCode: null,
            failureReason: null,
            updatedAt: new Date(),
          })
          .where(eq(payoutTable.id, payout.id));
        return "processing";
      }

      await this.markPendingVerification(
        attempt.id,
        verifiedPayout.message || "Payout verification pending",
        verification.raw,
      );
      return "unknown";
    } catch (error) {
      await this.markPendingVerification(
        attempt.id,
        error instanceof Error ? error.message : "Payout verification pending",
      );
      return "unknown";
    }
  }

  async settleAttempt(
    payout: PayoutRecord,
    attempt: PayoutAttemptRecord,
    rawPayload: unknown,
    koraFeeAmount: number,
  ) {
    if (attempt.status === "settled" || payout.status === "success") return;

    let notificationRecord: DriverNotification | null = null;
    const settledAt = new Date();

    await db.transaction(async (tx) => {
      await this.repo.updatePayoutAttempt(attempt.id, {
        status: "settled",
        koraFeeAmount,
        settledAt,
        rawWebhook: rawPayload,
      });

      const [updated] = await tx
        .update(payoutTable)
        .set({
          status: "success",
          koraFeeAmount,
          settledAt,
          nextRetryAt: null,
          failureCode: null,
          failureReason: null,
          rawFinalStatusResponse: rawPayload,
          updatedAt: new Date(),
        })
        .where(eq(payoutTable.id, payout.id))
        .returning();

      const earningRecord = payout.earningId
        ? await tx.query.earning.findFirst({
            where: eq(earning.id, payout.earningId),
          })
        : null;

      if (payout.earningId) {
        await tx
          .update(earning)
          .set({
            status: "paid",
            payoutId: payout.id,
            updatedAt: new Date(),
          })
          .where(eq(earning.id, payout.earningId));
      }

      if (earningRecord) {
        await this.driverService.adjustPaymentCountersForStatusChange(tx, {
          driverId: payout.driverId,
          amountMinor: earningRecord.netAmountMinor,
          previousStatus: earningRecord.status,
          nextStatus: "paid",
        });
      }

      await this.driverService.recordPayoutForDriver(tx, {
        driverId: payout.driverId,
        amountMinor: payout.amountMinor,
      });

      if (updated) {
        notificationRecord =
          await this.createPayoutSuccessNotification(tx, updated);
      }
    });

    if (notificationRecord) {
      publishNotificationCreatedInBackground(notificationRecord);
    }
  }

  async markPendingVerification(
    attemptId: string,
    failureReason: string,
    rawWebhook?: unknown,
  ) {
    await this.repo.updatePayoutAttempt(attemptId, {
      status: "pending_verification",
      failureReason,
      ...(rawWebhook === undefined ? {} : { rawWebhook }),
    });
  }

  private async createPayoutSuccessNotification(
    tx: PayoutTransaction,
    payoutRecord: PayoutRecord,
  ): Promise<DriverNotification> {
    return this.notificationService.createForDriverInTransaction(
      tx,
      payoutRecord.driverId,
      {
        notificationKey: `event:payout:${payoutRecord.id}:completed`,
        kind: "event",
        type: "payout_completed",
        title: "Payout sent successfully",
        message: `${formatAmountMinor(
          payoutRecord.amountMinor,
          payoutRecord.currency,
        )} was transferred to your account.`,
        href: "/payouts",
        tag: "Paid",
        tone: "positive",
        metadata: {
          payoutId: payoutRecord.id,
          reference: payoutRecord.reference,
        },
        occurredAt: new Date(),
      },
    );
  }
}
