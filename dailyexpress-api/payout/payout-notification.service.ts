import { renderEmail, getEmailSubject } from "@repo/email";
import { db } from "../db/connection";
import { eq } from "drizzle-orm";
import { earning, payout, type PayoutRecord } from "../db/index";
import { getConfig } from "../config/index";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import { driverService as sharedDriverService } from "../driver/driver.service";
import { notificationService as sharedNotificationService } from "../notification/notification.service";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { jobService } from "../workers/job.service";
import { formatAmountMinor } from "../utils/payout";
import type { DriverNotification } from "@shared/types";
import type { DbTransaction } from "../db/connection";

type PayoutTransaction = DbTransaction;

export class PayoutNotificationService {
  private readonly driverService = sharedDriverService;
  private readonly notificationService = sharedNotificationService;

  constructor(private repo: PayoutRepository) {}

  async processPayoutFailure(
    payoutRecord: PayoutRecord,
    reason: string,
    rawPayload: unknown,
    shouldNotify = false,
  ) {
    const [failureEmailDetails] = payoutRecord.driverEmail
      ? await this.repo.findRecipientWithDriver(payoutRecord.recipientId)
      : [];
    const recipientRecord = failureEmailDetails?.recipient ?? null;
    const driverRecord = failureEmailDetails?.driver ?? null;

    const driverName = driverRecord
      ? `${driverRecord.firstName} ${driverRecord.lastName}`.trim()
      : null;

    let emailHtml: string | null = null;
    let emailSubject: string | null = null;
    if (payoutRecord.driverEmail && recipientRecord) {
      const propsJson = JSON.stringify({
        frontendUrl: getConfig().FRONTEND_URL,
        driverName,
        driverEmail: payoutRecord.driverEmail,
        amountMinor: payoutRecord.amountMinor,
        reference: payoutRecord.reference,
        failureReason: reason,
        bankName: recipientRecord.bankName,
        accountLast4: recipientRecord.accountNumberLast4,
      });
      emailHtml = await renderEmail("PayoutFailedEmail", propsJson);
      emailSubject = getEmailSubject("PayoutFailedEmail", propsJson);
    }

    let notificationRecord: DriverNotification | null = null;
    await db.transaction(async (tx) => {
      const [lockedPayout] = await tx
        .select()
        .from(payout)
        .where(eq(payout.id, payoutRecord.id))
        .for("update")
        .limit(1);

      if (!lockedPayout) return;

      if (
        lockedPayout.status === "success" ||
        lockedPayout.status === "permanent_failed"
      ) {
        return;
      }

      await tx
        .update(payout)
        .set({
          status: "permanent_failed",
          failureCode: reason,
          failureReason: reason,
          nextRetryAt: null,
          failedAt: new Date(),
          rawFinalStatusResponse: rawPayload,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, lockedPayout.id));

      const earningId = lockedPayout.earningId;
      const earningRecord = earningId
        ? await tx.query.earning.findFirst({
            where: eq(earning.id, earningId),
          })
        : null;

      if (earningId) {
        await tx
          .update(earning)
          .set({
            status: "manual_review",
            payoutId: lockedPayout.id,
            updatedAt: new Date(),
          })
          .where(eq(earning.id, earningId));
        if (earningRecord) {
          await this.driverService.adjustPaymentCountersForStatusChange(tx, {
            driverId: earningRecord.driverId,
            amountMinor: earningRecord.netAmountMinor,
            previousStatus: earningRecord.status,
            nextStatus: "manual_review",
          });
        }
      }

      if (emailHtml && emailSubject && payoutRecord.driverEmail) {
        await jobService.enqueueEmail(tx, "email.payout_failed", {
          to: payoutRecord.driverEmail,
          subject: emailSubject,
          html: emailHtml,
        });
      }

      if (shouldNotify) {
        notificationRecord = await this.sendPayoutFailedNotification(
          tx,
          payoutRecord,
        );
      }
    });

    if (notificationRecord) {
      publishNotificationCreatedInBackground(notificationRecord);
    }
  }

  async sendPayoutSuccessNotification(
    tx: PayoutTransaction,
    payoutRecord: PayoutRecord,
  ) {
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

  async sendPayoutFailedNotification(
    tx: PayoutTransaction,
    payoutRecord: PayoutRecord,
  ) {
    return this.notificationService.createForDriverInTransaction(
      tx,
      payoutRecord.driverId,
      {
        notificationKey: `event:payout:${payoutRecord.id}:failed`,
        kind: "event",
        type: "payout_failed",
        title: "A payout needs review",
        message:
          payoutRecord.failureReason ||
          `${formatAmountMinor(
            payoutRecord.amountMinor,
            payoutRecord.currency,
          )} could not be transferred successfully.`,
        href: "/payouts",
        tag: "Action needed",
        tone: "critical",
        metadata: {
          payoutId: payoutRecord.id,
          reference: payoutRecord.reference,
        },
        occurredAt: new Date(),
      },
    );
  }
}

export const payoutNotificationService = new PayoutNotificationService(payoutRepository);
