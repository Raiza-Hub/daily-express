import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { payment } from "../db/index";
import { logger } from "../utils/logger";
import { koraClient } from "../payment/kora.client";
import { getBoss, QUEUES, type PayerInfoJobData } from "./boss";

export async function registerPayerInfoWorker() {
  const boss = await getBoss();

  await boss.work<PayerInfoJobData>(
    QUEUES.PAYER_INFO,
    {
      batchSize: 1,
      localConcurrency: 5,
      pollingIntervalSeconds: 2,
    },
    async ([job]) => {
      const { reference } = job.data;

      logger.info("worker.payer_info.started", {
        jobId: job.id,
        reference,
      });

      const verification = await koraClient.verifyTransaction(reference);

      if (verification.data.status.toLowerCase() !== "success") {
        return null;
      }

      const payerAccount = verification.data.bank_transfer?.payer_bank_account;
      if (!payerAccount) {
        return null;
      }

      await db.transaction(async (tx) => {
        await tx
          .update(payment)
          .set({
            payerBankName: payerAccount.bank_name,
            payerAccountNumber: payerAccount.account_number,
            payerAccountName: payerAccount.account_name,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(payment.reference, reference),
              eq(payment.status, "successful"),
            ),
          );
      });

      logger.info("worker.payer_info.completed", {
        jobId: job.id,
        reference,
      });
    },
  );

  await boss.work<PayerInfoJobData>(
    QUEUES.PAYER_INFO_DLQ,
    async ([job]) => {
      logger.error("worker.payer_info.dlq", {
        jobId: job.id,
        reference: job.data.reference,
      });
    },
  );
}