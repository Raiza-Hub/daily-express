import { renderEmail, getEmailSubject } from "@repo/email";
import { db } from "../db/connection";
import { and, eq } from "drizzle-orm";
import { earning, payout, type PayoutRecord } from "../db/index";
import { getConfig } from "../config/index";
import { notificationService as sharedNotificationService } from "../notification/notification.service";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { jobService } from "../workers/job.service";
import { formatAmount } from "../utils/payout";
import type { DriverNotification } from "@shared/types";
import type { DbTransaction } from "../db/connection";

type PayoutTransaction = DbTransaction;

export class PayoutNotificationService {
  private readonly notificationService = sharedNotificationService;

  async processPayoutFailure(
    payoutRecord: PayoutRecord,
    reason: string,
    shouldNotify = false,
  ) {
    let emailHtml: string | null = null;
    let emailSubject: string | null = null;
    if (payoutRecord.driverEmail && payoutRecord.recipientBankName && payoutRecord.recipientAccountLast4) {
      const propsJson = JSON.stringify({
        frontendUrl: getConfig().FRONTEND_URL,
        driverName: null,
        driverEmail: payoutRecord.driverEmail,
        amount: payoutRecord.amount,
        reference: payoutRecord.reference,
        failureReason: reason,
        bankName: payoutRecord.recipientBankName,
        accountLast4: payoutRecord.recipientAccountLast4,
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
        lockedPayout.status === "failed"
      ) {
        return;
      }

      await tx
        .update(payout)
        .set({
          status: "failed",
          failureCode: reason,
          failureReason: reason,
          failedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payout.id, lockedPayout.id));

      if (lockedPayout.tripId) {
        await tx
          .update(earning)
          .set({
            status: "available",
            payoutId: lockedPayout.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(earning.tripId, lockedPayout.tripId),
              eq(earning.status, "processing"),
            ),
          );
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
        type: "payout_completed",
        title: "Payout sent successfully",
        message: `${formatAmount(
          payoutRecord.amount,
          payoutRecord.currency,
        )} was transferred to your account.`,
        href: "/payouts",
        tag: "Paid",
        tone: "positive",
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
        type: "payout_failed",
        title: "A payout needs review",
        message:
          payoutRecord.failureReason ||
          `${formatAmount(
            payoutRecord.amount,
            payoutRecord.currency,
          )} could not be transferred successfully.`,
        href: "/payouts",
        tag: "Action needed",
        tone: "critical",
      },
    );
  }
}

export const payoutNotificationService = new PayoutNotificationService();
