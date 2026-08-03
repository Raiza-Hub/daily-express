import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { payment } from "../db/index";
import { logger } from "../utils/logger";
import { jobService } from "../workers/job.service";
import { PaymentRepository } from "./payment.repository";
import type { KoraVerifyResponse } from "./payment.types";

export class PaymentConfirmService {
  constructor(
    private repo: PaymentRepository,
  ) {}

  async confirmPayment(
    reference: string,
    verificationData: KoraVerifyResponse,
  ) {
    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      logger.info("payment.confirm_already_claimed", { reference });
      return;
    }

    const payerAccount = verificationData.bank_transfer?.payer_bank_account;

    await db.transaction(async (tx) => {
      await tx.update(payment)
        .set({
          status: "successful",
          payerBankName: payerAccount?.bank_name ?? null,
          payerAccountNumber: payerAccount?.account_number ?? null,
          payerAccountName: payerAccount?.account_name ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(payment.reference, reference), eq(payment.status, "processing")));

      await jobService.enqueue(tx, "allocation.process", {
        bookingId: claimed.bookingId,
        reference,
      });
    });
  }
}
