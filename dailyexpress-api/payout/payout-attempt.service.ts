import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { earning, payoutAttempt, payout as payoutTable } from "../db/index";
import { koraClient } from "../payment/kora.client";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import { driverService as sharedDriverService } from "../driver/driver.service";
import { notificationService as sharedNotificationService } from "../notification/notification.service";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { formatAmountMinor } from "../utils/payout";
import type { KoraPayoutHistoryItem } from "../payment/payment.types";
import type { DriverNotification } from "@shared/types";

import type { DbTransaction } from "../db/connection";
import type { PayoutRecord, PayoutAttemptRecord } from "../db/index";
type PayoutTransaction = DbTransaction;

export type AttemptVerificationOutcome =
  | "settled"
  | "failed"
  | "processing"
  | "unknown";

export class PayoutAttemptService {
  private readonly kora = koraClient;
  private readonly driverService = sharedDriverService;
  private readonly notificationService = sharedNotificationService;

  constructor(private repo: PayoutRepository) {}

  async verifyWithProvider(
    payout: PayoutRecord,
    attempt: PayoutAttemptRecord,
  ): Promise<AttemptVerificationOutcome> {
    try {
      const verification = await this.kora.findPayoutByReference(
        attempt.koraReference,
      );
      const verifiedPayout = verification.data as KoraPayoutHistoryItem | null;

      if (!verifiedPayout) {
        await this.updateToPendingVerification(
          attempt.id,
          "Payout verification pending",
          verification.raw,
        );
        return "unknown";
      }

      const providerStatus = verifiedPayout.status.toLowerCase();
      if (providerStatus === "success") {
        await this.finalizeAttempt(
          payout,
          attempt,
          verification.raw,
        );
        return "settled";
      }

      if (providerStatus === "failed") {
        await this.repo.updatePayoutAttempt(db, attempt.id, {
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
        await this.updateToPendingVerification(
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

      await this.updateToPendingVerification(
        attempt.id,
        verifiedPayout.message || "Payout verification pending",
        verification.raw,
      );
      return "unknown";
    } catch (error) {
      await this.updateToPendingVerification(
        attempt.id,
        error instanceof Error ? error.message : "Payout verification pending",
      );
      return "unknown";
    }
  }

  async finalizeAttempt(
    payout: PayoutRecord,
    attempt: PayoutAttemptRecord,
    rawPayload: unknown,
  ) {
    let notificationRecord: DriverNotification | null = null;
    const settledAt = new Date();

    // Prevents double finalization: re-reading payout + attempt under lock
    // ensures the second caller sees the updated status and leaves it alone.
    await db.transaction(async (tx) => {
      const [lockedPayout] = await tx
        .select()
        .from(payoutTable)
        .where(eq(payoutTable.id, payout.id))
        .for("update")
        .limit(1);
      if (!lockedPayout || lockedPayout.status === "success") return;

      const [lockedAttempt] = await tx
        .select()
        .from(payoutAttempt)
        .where(eq(payoutAttempt.id, attempt.id))
        .for("update")
        .limit(1);
      if (!lockedAttempt || lockedAttempt.status === "settled") return;

      await this.repo.updatePayoutAttempt(tx, lockedAttempt.id, {
        status: "settled",
        settledAt,
        rawWebhook: rawPayload,
      });

      const [updated] = await tx
        .update(payoutTable)
        .set({
          status: "success",
          settledAt,
          nextRetryAt: null,
          failureCode: null,
          failureReason: null,
          rawFinalStatusResponse: rawPayload,
          updatedAt: new Date(),
        })
        .where(eq(payoutTable.id, lockedPayout.id))
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

  async updateToPendingVerification(
    attemptId: string,
    failureReason: string,
    rawWebhook?: unknown,
  ) {
    await this.repo.updatePayoutAttempt(db, attemptId, {
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

export const payoutAttemptService = new PayoutAttemptService(payoutRepository);
