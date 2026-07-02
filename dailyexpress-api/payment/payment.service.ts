import { eq } from "drizzle-orm";
import { createServiceError } from "@shared/utils";
import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { booking, payment } from "../db/index";
import { getConfig } from "../config/index";
import { paymentRepository } from "./payment.repository";
import { enrichWithExpiry } from "./payment.utils";

import { paymentWebhookService } from "./payment-webhook.service";
import { paymentExpiryService } from "./payment-expiry.service";
import { paymentInitService } from "./payment-init.service";
import type {
  InitializePaymentInput,
  KoraWebhookPayload,
  PaymentStatus,
} from "./payment.types";
import type { PaymentRecord } from "../db/index";
import type { WebhookJobData } from "../workers/boss";

const TERMINAL_PAYMENT_STATUSES = [
  "successful",
  "failed",
  "cancelled",
  "expired",
] as const;

export class PaymentService {
  private readonly config = getConfig();

  constructor(
    private repo = paymentRepository,
    private webhookService = paymentWebhookService,
    private expiryService = paymentExpiryService,
    private initService = paymentInitService,
  ) {}

  async initializePayment(
    userId: string,
    authenticatedEmail: string,
    input: InitializePaymentInput,
  ) {
    return this.initService.initializePayment(userId, authenticatedEmail, input);
  }

  async getPaymentRecord(reference: string) {
    return this.repo.findPaymentByReference(reference);
  }

  async getPaymentStatus(reference: string) {
    const record = await this.repo.findPaymentByReference(reference);
    if (!record) {
      throw createServiceError("Payment not found", 404);
    }
    return this.paymentWithExpiry(record);
  }

  private async paymentWithExpiry(paymentRecord: PaymentRecord) {
    let expiresAt: Date | null = null;
    if (paymentRecord.bookingId) {
      const bookingRecord = await db.query.booking.findFirst({
        where: eq(booking.id, paymentRecord.bookingId),
        columns: { expiresAt: true },
      });
      expiresAt = bookingRecord?.expiresAt ?? null;
    }
    return enrichWithExpiry(paymentRecord, expiresAt);
  }

  async handlePaymentReturn(reference?: string | null) {
    const tripStatusUrl = `${this.config.FRONTEND_URL}/trip-status`;
    if (reference) {
      const existingPayment = await this.repo.findPaymentByReference(reference);
      logger.info("payment.return_redirect", {
        reference,
        found: Boolean(existingPayment),
        status: existingPayment?.status,
      });
    }
    return tripStatusUrl;
  }

  async handleKoraWebhook(webhook: KoraWebhookPayload, signature?: string) {
    return this.webhookService.processWebhook(webhook, signature);
  }

  async handleWebhookJob(job: WebhookJobData) {
    return this.webhookService.processWebhookJob(job);
  }

  async handlePaymentExpiry(payload: { bookingId: string; reference: string }) {
    return this.expiryService.expirePayment(payload.reference);
  }

  isTerminalStatus(status: PaymentStatus) {
    return (TERMINAL_PAYMENT_STATUSES as readonly string[]).includes(status);
  }

}

export const paymentService = new PaymentService();

