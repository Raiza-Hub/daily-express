import { renderEmail, getEmailSubject } from "@repo/email";
import { db } from "../db/connection";
import { and, eq } from "drizzle-orm";
import { earning, payout, type PayoutRecord } from "../db/index";
import { getConfig } from "../config/index";
import { enqueueEmail } from "../mail/email-dispatcher.service";

export class PayoutNotificationService {
  async processPayoutFailure(
    payoutRecord: PayoutRecord,
    reason: string,
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

    const shouldNotify = await db.transaction(async (tx): Promise<boolean> => {
      const [lockedPayout] = await tx
        .select()
        .from(payout)
        .where(eq(payout.id, payoutRecord.id))
        .for("update")
        .limit(1);

      if (!lockedPayout) return false;

      if (
        lockedPayout.status === "success" ||
        lockedPayout.status === "failed"
      ) {
        return false;
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
        await enqueueEmail(tx, {
          emailName: "email.payout_failed",
          to: payoutRecord.driverEmail,
          subject: emailSubject,
          html: emailHtml,
        });
      }

      return true;
    });
  }
}

export const payoutNotificationService = new PayoutNotificationService();