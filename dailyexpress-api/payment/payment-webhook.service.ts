import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { payment } from "../db/index";
import { logger } from "../utils/logger";
import { getPaymentReference } from "../utils/payment";
import { jobService } from "../workers/job.service";
import type { WebhookJobData } from "../workers/boss";
import { koraClient } from "./kora.client";
import { PaymentRepository } from "./payment.repository";
import { PaymentPayoutRefundService } from "./payment-payout-refund.service";
import { payoutWebhookService } from "../payout/payout-webhook.service";
import type {
    KoraPayoutWebhookPayload,
    KoraWebhookPayload,
} from "./payment.types";

export class PaymentWebhookService {
  private readonly kora = koraClient;

  constructor(
    private repo: PaymentRepository,
    private payoutRefundService: PaymentPayoutRefundService,
  ) {}

  async processWebhook(webhook: KoraWebhookPayload, signature?: string) {
    if (webhook.event.startsWith("transfer.")) {
      if (webhook.data.reference?.startsWith("REF-")) {
        const signatureValid = this.kora.verifyWebhookSignature(
          webhook.data,
          signature,
        );

        const actualRef = webhook.data.reference.slice(4);

        if (signatureValid) {
          const targetStatus = webhook.event === "transfer.success" ? "refunded" : "refund_failed";
          await this.payoutRefundService.finalizeRefund(actualRef, targetStatus);
        }
      } else {
        await payoutWebhookService.processWebhook({
          signature,
          event: webhook as KoraPayoutWebhookPayload,
        });
      }
      return;
    }

    const signatureValid = this.kora.verifyWebhookSignature(
      webhook.data,
      signature,
    );

    const paymentRef = webhook.data.payment_reference || webhook.data.reference;
    if (!paymentRef) {
      logger.warn("payment.webhook_missing_reference", { event: webhook.event });
      return;
    }

    if (signatureValid) {
      await this.processWebhookJob({
        event: webhook.event,
        data: webhook.data,
        _retryCount: 0,
      });
    }

    if (!signatureValid) {
      logger.warn("payment.webhook_invalid_signature_ignored", {
        event: webhook.event,
        paymentReference: paymentRef,
      });
    }
  }

  async processWebhookJob(job: WebhookJobData) {
    const reference = getPaymentReference(job);
    if (!reference) {
      logger.warn("payment.webhook_missing_reference", { event: job.event });
      return;
    }

    switch (job.event) {
      case "charge.success":
        await this.processChargeSuccess(reference);
        return;
      case "charge.failed":
        await this.processChargeFailure(reference);
        return;
      default:
        logger.info("payment.webhook_ignored", { event: job.event, reference });
    }
  }

  private async processChargeSuccess(reference: string) {
    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      logger.info("payment.webhook_already_claimed", { reference });
      return;
    }

    const verification = await this.kora.verifyTransaction(reference);
    if (verification.data.status.toLowerCase() !== "success") {
      await this.repo.updateProcessingPayment(reference, "failed", {
        failureCode: "VERIFICATION_MISMATCH",
        failureReason: `Webhook indicated success but verification returned ${verification.data.status}`,
        providerStatus: verification.data.status,
      });
      return;
    }

    const payerAccount = verification.data.bank_transfer?.payer_bank_account;

    await db.transaction(async (tx) => {
      await tx.update(payment)
        .set({
          status: "successful",
          paidAt: new Date(),
          payerBankName: payerAccount?.bank_name ?? null,
          payerAccountNumber: payerAccount?.account_number ?? null,
          payerAccountName: payerAccount?.account_name ?? null,
          providerStatus: "success",
          lastStatusCheckAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(payment.reference, reference), eq(payment.status, "processing")));

      await jobService.enqueue(tx, "allocation.process", {
        bookingId: claimed.bookingId,
        reference,
      });
    });
  }

  private async processChargeFailure(reference: string) {
    const verification = await this.kora.verifyTransaction(reference);

    if (verification.data.status.toLowerCase() === "success") {
      await this.processChargeSuccess(reference);
      return;
    }

    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      logger.info("payment.webhook_fail_already_claimed", { reference });
      return;
    }

    await this.repo.updateProcessingPayment(reference, "failed", {
      failureCode: "PAYMENT_FAILED",
      failureReason: verification.data.message || "Payment provider reported a failed charge",
      providerStatus: verification.data.status,
    });
  }
}
