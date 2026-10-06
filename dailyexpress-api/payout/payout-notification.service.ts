import { renderEmail, getEmailSubject } from "@repo/email";
import { db } from "../db/connection";
import { eq } from "drizzle-orm";
import { payout, type PayoutRecord } from "../db/index";
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

    await db.transaction(async (tx) => {
      const [lockedPayout] = await tx
        .select()
        .from(payout)
        .where(eq(payout.id, payoutRecord.id))
        .for("update")
        .limit(1);

      if (!lockedPayout) return;

      if (
        lockedPayout.status === "successful" ||
        lockedPayout.status === "failed"
      ) {
        return;
      }

      await tx
        .update(payout)
        .set({
          status: "failed",
          updatedAt: new Date(),
        })
        .where(eq(payout.id, lockedPayout.id));

      if (emailHtml && emailSubject && payoutRecord.driverEmail) {
        await enqueueEmail(tx, {
          emailName: "email.payout_failed",
          to: payoutRecord.driverEmail,
          subject: emailSubject,
          html: emailHtml,
        });
      }
    });
  }
}

export const payoutNotificationService = new PayoutNotificationService();