import { and, eq } from "drizzle-orm";

import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { payment } from "../db/index";
import { getConfig } from "../config/index";
import { PaymentRepository } from "./payment.repository";
import { PaymentInitService } from "./payment-init.service";
import { PaymentConfirmService } from "./payment-confirm.service";
import { PaymentPayoutRefundService } from "./payment-payout-refund.service";
import { PaymentWebhookService } from "./payment-webhook.service";

import { KoraClient } from "./kora.client";
import type {
  InitializePaymentInput,
  KoraWebhookPayload,
  PaymentStatus,
} from "./payment.types";
import type { WebhookJobData } from "../workers/boss";

export class PaymentService {
  private readonly config = getConfig();
  private readonly repo = new PaymentRepository();
  private readonly kora = new KoraClient();
  private readonly confirmService = new PaymentConfirmService(this.repo);
  private readonly payoutRefundService = new PaymentPayoutRefundService(this.repo, this.kora);
  private readonly webhookService = new PaymentWebhookService(this.repo, this.payoutRefundService);
  private readonly initService = new PaymentInitService(this.repo);

  async initializePayment(
    userId: string,
    authenticatedEmail: string,
    input: InitializePaymentInput,
  ) {
    return this.initService.initializePayment(userId, authenticatedEmail, input);
  }

  async transitionPendingPayment(
    reference: string,
    nextStatus: Extract<PaymentStatus, "failed" | "cancelled" | "expired">,
    reason: string,
    options?: {
      cleanupProjection?: boolean;
      failureCode?: string;
      failedAt?: Date | null;
      providerStatus?: string | null;
    },
  ) {
    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment) return null;
    if (existingPayment.status !== "pending") {
      return existingPayment;
    }

    const [updatedPayment] = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(payment)
        .set({
          status: nextStatus,
          providerStatus:
            options?.providerStatus || existingPayment.providerStatus,
          lastStatusCheckAt: new Date(),
          failedAt: options?.failedAt ?? existingPayment.failedAt ?? new Date(),
          failureCode: options?.failureCode || existingPayment.failureCode,
          failureReason: reason,
          updatedAt: new Date(),
        })
        .where(
          and(eq(payment.reference, reference), eq(payment.status, "pending")),
        )
        .returning();

      if (!record) return [];

      await this.repo.updateBookingPaymentStatus(tx, {
        bookingId: record.bookingId,
        paymentReference: reference,
        paymentStatus: nextStatus,
      });

      return [record];
    });

    if (!updatedPayment) {
      const latest = await this.repo.findPaymentByReference(reference);
      return latest || null;
    }

    logger.info("payment.failed", {
      bookingId: updatedPayment.bookingId,
      reference,
      status: nextStatus,
    });

    return updatedPayment;
  }

  async resolveReturnUrl(reference?: string | null) {
    const tripStatusUrl = `${this.config.FRONTEND_URL}/trip-status`;
    if (!reference) return tripStatusUrl;

    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment) return tripStatusUrl;

    try {
      const verification = await this.kora.verifyTransaction(reference);
      const providerStatus = verification.data.status.toLowerCase();

      if (providerStatus === "success") {
        await this.confirmService.confirmPayment(
          reference,
          verification.data,
        );
        return tripStatusUrl;
      }

      await this.transitionPendingPayment(
        reference,
        "expired",
        verification.data.message || "Payment was not completed",
        {
          failureCode: "PAYMENT_NOT_COMPLETED",
          providerStatus: verification.data.status,
        },
      );
      return tripStatusUrl;
    } catch (error) {
      logger.error("payment.return_verification_failed", {
        reference,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return tripStatusUrl;
  }

  async handleKoraWebhook(webhook: KoraWebhookPayload, signature?: string) {
    return this.webhookService.processWebhook(webhook, signature);
  }

  async processWebhookJob(job: WebhookJobData) {
    return this.webhookService.processWebhookJob(job);
  }

}

export const paymentService = new PaymentService();
