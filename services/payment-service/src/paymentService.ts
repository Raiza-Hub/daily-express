import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import type { BookingCreatedEvent } from "@shared/kafka";
import { logger } from "@shared/logger";
import { sentryServer } from "@shared/sentry";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { db } from "../db/db";
import { bookingHold, outboxEvents, payment, paymentWebhook } from "../db/schema";
import { getBoss, QUEUES, type PaymentExpireJobData, type WebhookJobData } from "./boss";
import { loadConfig } from "./config";
import { KoraClient } from "./kora.client";
import {
  emitPaymentCompleted,
  emitPaymentFailed,
  sendRefundFailedNotification,
} from "./kafka/producer";
import type {
  InitializePaymentInput,
  KoraChannel,
  KoraVerifyResponse,
  KoraWebhookPayload,
  PaymentStatus,
  UpsertBookingHoldInput,
} from "./types";

type PaymentRecord = typeof payment.$inferSelect;
type BookingHoldRecord = typeof bookingHold.$inferSelect;
export type PaymentWithExpiry = PaymentRecord & { expiresAt?: Date | null };

type FailureStatus = Extract<PaymentStatus, "failed" | "cancelled" | "expired">;

const KORA_METADATA_KEY_REGEX = /^[A-Za-z0-9-]{1,20}$/;
const TERMINAL_OUTBOX_EVENT_TYPES = ["payment.completed", "payment.failed"] as const;
const CHECKOUT_FEE_RATE = 0.1;

function dedupeChannels(channels?: KoraChannel[]) {
  if (!channels?.length) {
    return null;
  }

  const uniqueChannels: KoraChannel[] = [];
  for (const channel of channels) {
    if (!uniqueChannels.includes(channel)) {
      uniqueChannels.push(channel);
    }
  }

  return uniqueChannels;
}

function normalizeAmount(value: number | string | null | undefined) {
  if (typeof value === "number") {
    return Math.round(value);
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  return null;
}

function parseDate(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function calculateTrustedChargeAmount(fareAmount: number) {
  return Math.round(fareAmount * (1 + CHECKOUT_FEE_RATE));
}

class PaymentService {
  private readonly config = loadConfig();
  private readonly koraClient = new KoraClient();

  private logKoraVerificationResponse(
    source:
      | "initialize_retry"
      | "return_url"
      | "webhook_charge_success"
      | "webhook_charge_failed"
      | "payment_expiry_refund",
    reference: string,
    verification: Pick<
      KoraVerifyResponse,
      | "status"
      | "reference"
      | "payment_reference"
      | "amount"
      | "amount_paid"
      | "currency"
      | "paid_at"
      | "transaction_date"
    >,
  ) {
    logger.info("payment.kora_verification_response", {
      source,
      requestedReference: reference,
      providerReference: verification.reference || null,
      providerPaymentReference: verification.payment_reference || null,
      providerStatus: verification.status,
      amount: verification.amount,
      amountPaid: verification.amount_paid ?? null,
      currency: verification.currency,
      paidAt: verification.paid_at || null,
      transactionDate: verification.transaction_date || null,
    });
  }

  private capturePaymentException(
    error: unknown,
    distinctId: string | null | undefined,
    action: string,
    values?: Record<string, unknown>,
  ) {
    sentryServer.captureException(error, distinctId || "unknown", {
      action,
      ...(values ? { values } : {}),
    });
  }

  private buildReference(reference?: string) {
    return reference?.trim() || `DX-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private sanitizeOptional(value?: string | null) {
    if (!value) {
      return null;
    }

    return sanitizeInput(value);
  }

  private buildMetadata(input: InitializePaymentInput) {
    const metadataEntries: Array<[string, unknown]> = [["bookingId", input.bookingId]];
    if (input.metadata) {
      metadataEntries.push(...Object.entries(input.metadata));
    }

    const metadata: Record<string, string | number | boolean> = {};

    for (const [key, value] of metadataEntries) {
      if (
        Object.keys(metadata).length >= 5 ||
        key in metadata ||
        !KORA_METADATA_KEY_REGEX.test(key)
      ) {
        continue;
      }

      if (typeof value === "string") {
        const sanitized = sanitizeInput(value);
        if (sanitized) {
          metadata[key] = sanitized;
        }
        continue;
      }

      if (typeof value === "number" && Number.isFinite(value)) {
        metadata[key] = value;
        continue;
      }

      if (typeof value === "boolean") {
        metadata[key] = value;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private getPaymentPublicBaseUrl() {
    if (this.config.paymentPublicBaseUrl) {
      return this.config.paymentPublicBaseUrl.replace(/\/$/, "");
    }

    if (this.config.koraWebhookUrl) {
      return this.config.koraWebhookUrl.replace(/\/v1\/payments\/webhooks\/kora$/, "");
    }

    throw createServiceError(
      "PAYMENT_PUBLIC_BASE_URL or KORA_WEBHOOK_URL must be configured",
      500,
    );
  }

  private getReturnUrl(reference: string) {
    return `${this.getPaymentPublicBaseUrl()}/v1/payments/return?ref=${encodeURIComponent(reference)}`;
  }

  private getWebhookUrl() {
    return (
      this.config.koraWebhookUrl ||
      `${this.getPaymentPublicBaseUrl()}/v1/payments/webhooks/kora`
    );
  }

  async getPaymentRecord(reference: string) {
    return db.query.payment.findFirst({
      where: eq(payment.reference, reference),
    });
  }

  async getBookingHoldRecord(bookingId: string) {
    return db.query.bookingHold.findFirst({
      where: eq(bookingHold.bookingId, bookingId),
    });
  }

  private attachExpiry(
    paymentRecord: PaymentRecord,
    hold?: BookingHoldRecord | null,
  ): PaymentWithExpiry {
    if (!paymentRecord.bookingId) {
      return paymentRecord;
    }

    return {
      ...paymentRecord,
      expiresAt: hold?.expiresAt || null,
    };
  }

  async withExpiry(
    paymentRecord: PaymentRecord,
    hold?: BookingHoldRecord | null,
  ): Promise<PaymentWithExpiry> {
    if (!paymentRecord.bookingId) {
      return paymentRecord;
    }

    if (hold !== undefined) {
      return this.attachExpiry(paymentRecord, hold);
    }

    const resolvedHold = await this.getBookingHoldRecord(paymentRecord.bookingId);
    return this.attachExpiry(paymentRecord, resolvedHold);
  }

  async getTerminalOutboxEvent(reference: string) {
    return db.query.outboxEvents.findFirst({
      where: and(
        eq(outboxEvents.aggregateId, reference),
        inArray(outboxEvents.eventType, [...TERMINAL_OUTBOX_EVENT_TYPES]),
      ),
    });
  }

  async schedulePaymentExpiry(
    bookingId: string,
    reference: string,
    expiresAt: Date,
  ) {
    const boss = await getBoss();
    const jobId = await boss.send(
      QUEUES.PAYMENT_EXPIRE,
      { bookingId, reference },
      {
        startAfter: expiresAt,
        singletonKey: `expire-${bookingId}`,
      },
    );

    if (jobId) {
      await db
        .update(bookingHold)
        .set({
          pgBossJobId: jobId,
          updatedAt: new Date(),
        })
        .where(eq(bookingHold.bookingId, bookingId));
    }

    return jobId;
  }

  private isRetryableProviderStatus(status: string) {
    return ["abandoned", "cancelled", "closed", "failed"].includes(
      status.toLowerCase(),
    );
  }

  private isReusableProviderStatus(status: string) {
    return ["pending", "processing"].includes(status.toLowerCase());
  }

  private async refreshPendingCheckout(
    existingPayment: PaymentRecord,
    authenticatedEmail: string,
    input: InitializePaymentInput,
    hold: BookingHoldRecord,
    providerStatus: string,
  ) {
    const reference = this.buildReference();
    const channels = dedupeChannels(input.channels);
    const metadata = this.buildMetadata(input);
    const productName = sanitizeInput(input.productName);
    const productDescription = sanitizeInput(input.productDescription);
    const trustedCurrency = hold.currency.toUpperCase();
    const trustedAmount = calculateTrustedChargeAmount(hold.fareAmount);

    if (input.currency && input.currency.toUpperCase() !== trustedCurrency) {
      throw createServiceError(
        "Payment currency does not match booking currency",
        400,
      );
    }

    logger.info("payment.checkout_retry_refreshing", {
      bookingId: existingPayment.bookingId,
      previousReference: existingPayment.reference,
      providerStatus,
    });

    const initializeResponse = await this.koraClient.initializeTransaction({
      customer: {
        email: authenticatedEmail.trim(),
        name: input.customerName || existingPayment.customerName || undefined,
      },
      amount: trustedAmount,
      reference,
      currency: trustedCurrency,
      redirect_url: this.getReturnUrl(reference),
      notification_url: this.getWebhookUrl(),
      narration: productDescription,
      ...(channels ? { channels } : {}),
      metadata,
    });

    const [updatedPayment] = await db
      .update(payment)
      .set({
        reference,
        amount: trustedAmount,
        currency: trustedCurrency,
        productName,
        productDescription,
        customerName: this.sanitizeOptional(
          input.customerName || existingPayment.customerName,
        ),
        customerEmail: authenticatedEmail.trim(),
        customerMobile: this.sanitizeOptional(
          input.customerMobile || existingPayment.customerMobile,
        ),
        status: "pending",
        providerStatus: "pending",
        providerTransactionId: null,
        checkoutUrl: initializeResponse.data.checkout_url,
        checkoutToken: initializeResponse.data.reference,
        redirectUrl: this.getReturnUrl(reference),
        cancelUrl: `${this.config.frontendUrl}/trip-status`,
        channels,
        rawInitializeResponse: initializeResponse.raw,
        rawVerificationResponse: null,
        lastStatusCheckAt: new Date(),
        paidAt: null,
        failedAt: null,
        failureCode: null,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(payment.id, existingPayment.id), eq(payment.status, "pending")))
      .returning();

    if (!updatedPayment) {
      const latest = await this.getPaymentRecord(existingPayment.reference);
      return latest ? this.withExpiry(latest, hold) : null;
    }

    const refreshedHold = await this.cancelExpiryJob(existingPayment.bookingId, hold);

    await this.schedulePaymentExpiry(
      input.bookingId,
      reference,
      refreshedHold?.expiresAt || hold.expiresAt,
    );

    logger.info("payment.checkout_retry_refreshed", {
      bookingId: input.bookingId,
      previousReference: existingPayment.reference,
      reference,
    });

    return this.withExpiry(updatedPayment, refreshedHold || hold);
  }

  private async resolveExistingPendingCheckout(
    existingPayment: PaymentRecord,
    authenticatedEmail: string,
    input: InitializePaymentInput,
    hold: BookingHoldRecord,
  ) {
    const verification = await this.koraClient.verifyTransaction(
      existingPayment.reference,
    );
    this.logKoraVerificationResponse(
      "initialize_retry",
      existingPayment.reference,
      verification.data,
    );

    const providerStatus = verification.data.status.toLowerCase();

    if (providerStatus === "success") {
      const confirmedPayment = await this.confirmPendingPaymentSuccess(
        existingPayment.reference,
        verification.data,
        verification.raw,
      );

      return confirmedPayment || this.withExpiry(existingPayment, hold);
    }

    if (this.isReusableProviderStatus(providerStatus)) {
      return this.withExpiry(existingPayment, hold);
    }

    if (this.isRetryableProviderStatus(providerStatus)) {
      const refreshedPayment = await this.refreshPendingCheckout(
        existingPayment,
        authenticatedEmail,
        input,
        hold,
        providerStatus,
      );

      return refreshedPayment || this.withExpiry(existingPayment, hold);
    }

    logger.warn("payment.checkout_retry_unhandled_provider_status", {
      bookingId: existingPayment.bookingId,
      reference: existingPayment.reference,
      providerStatus,
    });

    return this.withExpiry(existingPayment, hold);
  }

  async cancelExpiryJob(
    bookingId?: string | null,
    hold?: BookingHoldRecord | null,
  ): Promise<BookingHoldRecord | null> {
    if (!bookingId) {
      return null;
    }

    const resolvedHold = hold ?? (await this.getBookingHoldRecord(bookingId));
    if (!resolvedHold?.pgBossJobId) {
      return resolvedHold || null;
    }

    const boss = await getBoss();
    await boss.cancel(QUEUES.PAYMENT_EXPIRE, resolvedHold.pgBossJobId);

    await db
      .update(bookingHold)
      .set({
        pgBossJobId: null,
        updatedAt: new Date(),
      })
      .where(eq(bookingHold.bookingId, bookingId));

    return {
      ...resolvedHold,
      pgBossJobId: null,
      updatedAt: new Date(),
    };
  }

  async deleteBookingHold(bookingId?: string | null) {
    if (!bookingId) {
      return;
    }

    await db
      .delete(bookingHold)
      .where(eq(bookingHold.bookingId, bookingId));
  }

  private async emitPaymentCompletedIfNeeded(paymentRecord: PaymentRecord) {
    const terminalEvent = await this.getTerminalOutboxEvent(paymentRecord.reference);
    if (terminalEvent) {
      return;
    }

    await emitPaymentCompleted({
      paymentId: paymentRecord.id,
      bookingId: paymentRecord.bookingId,
      paymentReference: paymentRecord.reference,
      paidAt: paymentRecord.paidAt?.toISOString() ?? null,
      userEmail: paymentRecord.customerEmail || undefined,
    });
  }

  private async emitPaymentFailedIfNeeded(
    paymentRecord: PaymentRecord,
    paymentStatus: FailureStatus,
    failureReason: string,
  ) {
    const terminalEvent = await this.getTerminalOutboxEvent(paymentRecord.reference);
    if (terminalEvent) {
      return;
    }

    await emitPaymentFailed({
      paymentId: paymentRecord.id,
      bookingId: paymentRecord.bookingId,
      paymentReference: paymentRecord.reference,
      paymentStatus,
      failureReason,
    });
  }

  private async sendRefundFailureEmail(
    paymentRecord: PaymentRecord,
    failureReason: string,
  ) {
    if (!paymentRecord.customerEmail) {
      logger.warn("payment.refund_failed_email_skipped", {
        reason: "recipient_missing",
        reference: paymentRecord.reference,
      });
      return;
    }

    const propsJson = JSON.stringify({
      frontendUrl: this.config.frontendUrl,
      customerName: paymentRecord.customerName || null,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      bookingId: paymentRecord.bookingId,
      amountMinor: paymentRecord.amount,
      currency: paymentRecord.currency,
      productName: paymentRecord.productName,
      failureReason,
      supportEmail: "support@dailyexpress.com",
      supportPhone: "07008888328",
    });

    await sendRefundFailedNotification({
      to: paymentRecord.customerEmail,
      subject: "Refund could not be completed yet",
      template: "RefundFailedEmail",
      propsJson,
    });
  }

  async initializePayment(
    userId: string,
    authenticatedEmail: string,
    input: InitializePaymentInput,
  ): Promise<PaymentWithExpiry> {
    const hold = await this.getBookingHoldRecord(input.bookingId);

    if (!hold) {
      throw createServiceError("Booking not found", 404);
    }

    if (hold.expiresAt.getTime() <= Date.now()) {
      throw createServiceError(
        "Seat reservation has expired - cannot initialize payment",
        400,
      );
    }

    if (hold.userId !== userId) {
      throw createServiceError("Booking not found", 404);
    }

    const existingPayment = await db.query.payment.findFirst({
      where: eq(payment.bookingId, input.bookingId),
    });

    if (existingPayment && existingPayment.userId !== userId) {
      throw createServiceError("Booking not found", 404);
    }

    if (existingPayment?.status === "pending") {
      return this.resolveExistingPendingCheckout(
        existingPayment,
        authenticatedEmail,
        input,
        hold,
      );
    }

    if (existingPayment) {
      return this.withExpiry(existingPayment, hold);
    }

    const reference = this.buildReference(input.reference);
    const channels = dedupeChannels(input.channels);
    const metadata = this.buildMetadata(input);
    const productName = sanitizeInput(input.productName);
    const productDescription = sanitizeInput(input.productDescription);
    const trustedCurrency = hold.currency.toUpperCase();
    const trustedAmount = calculateTrustedChargeAmount(hold.fareAmount);

    if (
      input.currency &&
      input.currency.toUpperCase() !== trustedCurrency
    ) {
      throw createServiceError(
        "Payment currency does not match booking currency",
        400,
      );
    }

    const initializeResponse = await this.koraClient.initializeTransaction({
      customer: {
        email: authenticatedEmail.trim(),
        name: input.customerName,
      },
      amount: trustedAmount,
      reference,
      currency: trustedCurrency,
      redirect_url: this.getReturnUrl(reference),
      notification_url: this.getWebhookUrl(),
      narration: productDescription,
      ...(channels ? { channels } : {}),
      metadata,
    });

    const [insertedPayment] = await db
      .insert(payment)
      .values({
        userId,
        bookingId: input.bookingId,
        provider: "kora",
        reference,
        amount: trustedAmount,
        currency: trustedCurrency,
        productName,
        productDescription,
        customerName: this.sanitizeOptional(input.customerName),
        customerEmail: authenticatedEmail.trim(),
        customerMobile: this.sanitizeOptional(input.customerMobile),
        status: "pending",
        providerStatus: "pending",
        checkoutUrl: initializeResponse.data.checkout_url,
        checkoutToken: initializeResponse.data.reference,
        redirectUrl: this.getReturnUrl(reference),
        cancelUrl: `${this.config.frontendUrl}/trip-status`,
        channels,
        rawInitializeResponse: initializeResponse.raw,
        metadata,
      })
      .returning();

    await this.schedulePaymentExpiry(input.bookingId, reference, hold.expiresAt);

    logger.info("payment.initialized", {
      bookingId: input.bookingId,
      reference,
    });

    return this.attachExpiry(insertedPayment, hold);
  }

  async confirmPendingPaymentSuccess(
    reference: string,
    verification: KoraVerifyResponse,
    rawVerificationResponse: unknown,
  ): Promise<PaymentWithExpiry | null> {
    const existingPayment = await this.getPaymentRecord(reference);
    if (!existingPayment) {
      return null;
    }

    if (existingPayment.status !== "pending") {
      return this.withExpiry(existingPayment);
    }

    const verifiedAmount = normalizeAmount(
      verification.amount_paid ?? verification.amount,
    );

    if (verifiedAmount === null || verifiedAmount !== existingPayment.amount) {
      return this.failPendingPayment(
        reference,
        "failed",
        "Verified payment amount does not match the booking total",
        {
          failureCode: "AMOUNT_MISMATCH",
          providerStatus: verification.status,
          rawVerificationResponse,
        },
      );
    }

    if (verification.currency.toUpperCase() !== existingPayment.currency) {
      return this.failPendingPayment(
        reference,
        "failed",
        "Verified payment currency does not match the booking currency",
        {
          failureCode: "CURRENCY_MISMATCH",
          providerStatus: verification.status,
          rawVerificationResponse,
        },
      );
    }

    const paidAt =
      parseDate(verification.paid_at) ||
      parseDate(verification.transaction_date) ||
      new Date();

    const [updatedPayment] = await db
      .update(payment)
      .set({
        status: "successful",
        providerStatus: verification.status,
        providerTransactionId:
          verification.payment_reference ||
          verification.reference ||
          existingPayment.providerTransactionId,
        rawVerificationResponse,
        lastStatusCheckAt: new Date(),
        paidAt,
        failedAt: null,
        failureCode: null,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(and(eq(payment.reference, reference), eq(payment.status, "pending")))
      .returning();

    if (!updatedPayment) {
      const latest = await this.getPaymentRecord(reference);
      return latest ? this.withExpiry(latest) : null;
    }

    const hold = updatedPayment.bookingId
      ? await this.getBookingHoldRecord(updatedPayment.bookingId)
      : null;
    await this.cancelExpiryJob(updatedPayment.bookingId, hold);
    await this.emitPaymentCompletedIfNeeded(updatedPayment);

    logger.info("payment.confirmed", {
      bookingId: updatedPayment.bookingId,
      reference,
    });

    return this.withExpiry(updatedPayment, hold);
  }

  async failPendingPayment(
    reference: string,
    nextStatus: FailureStatus,
    reason: string,
    options?: {
      cleanupProjection?: boolean;
      failureCode?: string;
      failedAt?: Date | null;
      providerStatus?: string | null;
      rawVerificationResponse?: unknown;
    },
  ): Promise<PaymentWithExpiry | null> {
    const existingPayment = await this.getPaymentRecord(reference);
    if (!existingPayment) {
      return null;
    }

    if (existingPayment.status !== "pending") {
      return this.withExpiry(existingPayment);
    }

    const [updatedPayment] = await db
      .update(payment)
      .set({
        status: nextStatus,
        providerStatus: options?.providerStatus || existingPayment.providerStatus,
        rawVerificationResponse:
          options?.rawVerificationResponse ?? existingPayment.rawVerificationResponse,
        lastStatusCheckAt: new Date(),
        failedAt: options?.failedAt ?? existingPayment.failedAt ?? new Date(),
        failureCode: options?.failureCode || existingPayment.failureCode,
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(and(eq(payment.reference, reference), eq(payment.status, "pending")))
      .returning();

    if (!updatedPayment) {
      const latest = await this.getPaymentRecord(reference);
      return latest ? this.withExpiry(latest) : null;
    }

    const hold = updatedPayment.bookingId
      ? await this.getBookingHoldRecord(updatedPayment.bookingId)
      : null;
    await this.cancelExpiryJob(updatedPayment.bookingId, hold);

    if (options?.cleanupProjection ?? true) {
      await this.deleteBookingHold(updatedPayment.bookingId);
    }

    await this.emitPaymentFailedIfNeeded(updatedPayment, nextStatus, reason);

    logger.info("payment.failed", {
      bookingId: updatedPayment.bookingId,
      reference,
      status: nextStatus,
    });

    return this.withExpiry(
      updatedPayment,
      options?.cleanupProjection ?? true ? null : hold,
    );
  }

  async initiateAutoRefund(
    reference: string,
    verification: Pick<
      KoraVerifyResponse,
      "amount" | "currency" | "paid_at" | "payment_reference" | "reference" | "status"
    >,
    rawVerificationResponse: unknown,
    reason = "Seat reservation expired before payment was completed",
  ): Promise<PaymentWithExpiry | null> {
    const existingPayment = await this.getPaymentRecord(reference);
    if (!existingPayment) {
      return null;
    }

    if (
      existingPayment.status === "refund_pending" ||
      existingPayment.status === "refunded" ||
      existingPayment.status === "refund_failed"
    ) {
      return this.withExpiry(existingPayment);
    }

    const verifiedAmount = normalizeAmount(verification.amount);
    if (verifiedAmount === null || verifiedAmount !== existingPayment.amount) {
      return this.failPendingPayment(reference, "failed", reason, {
        failureCode: "AMOUNT_MISMATCH",
        providerStatus: verification.status,
        rawVerificationResponse,
      });
    }

    if (verification.currency.toUpperCase() !== existingPayment.currency) {
      return this.failPendingPayment(reference, "failed", reason, {
        failureCode: "CURRENCY_MISMATCH",
        providerStatus: verification.status,
        rawVerificationResponse,
      });
    }

    const [updatedPayment] = await db
      .update(payment)
      .set({
        status: "refund_pending",
        providerStatus: verification.status,
        providerTransactionId:
          verification.payment_reference ||
          verification.reference ||
          existingPayment.providerTransactionId,
        rawVerificationResponse,
        lastStatusCheckAt: new Date(),
        paidAt: parseDate(verification.paid_at) || existingPayment.paidAt || new Date(),
        failureCode: "AUTO_REFUND_INITIATED",
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(payment.reference, reference),
          inArray(payment.status, ["pending", "successful"]),
        ),
      )
      .returning();

    if (!updatedPayment) {
      const latest = await this.getPaymentRecord(reference);
      return latest ? this.withExpiry(latest) : null;
    }

    const hold = updatedPayment.bookingId
      ? await this.getBookingHoldRecord(updatedPayment.bookingId)
      : null;
    await this.cancelExpiryJob(updatedPayment.bookingId, hold);
    await this.deleteBookingHold(updatedPayment.bookingId);
    await this.emitPaymentFailedIfNeeded(updatedPayment, "expired", reason);

    try {
      await this.koraClient.initiateRefund({
        reference: `RFD-${updatedPayment.reference}`,
        payment_reference: updatedPayment.reference,
        reason,
      });
    } catch (error) {
      await db
        .update(payment)
        .set({
          status: "refund_failed",
          updatedAt: new Date(),
        })
        .where(eq(payment.id, updatedPayment.id));

      try {
        await this.sendRefundFailureEmail(updatedPayment, reason);
      } catch (notificationError) {
        this.capturePaymentException(
          notificationError,
          updatedPayment.userId,
          "sendRefundFailureEmail",
          {
            bookingId: updatedPayment.bookingId,
            reference,
            reason,
          },
        );
        logger.error("payment.refund_failed_email_error", {
          reference,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      }

      throw error;
    }

    logger.info("payment.auto_refund_initiated", {
      bookingId: updatedPayment.bookingId,
      reference,
    });

    return this.withExpiry(updatedPayment, null);
  }

  async handleKoraWebhook(
    webhook: KoraWebhookPayload,
    signature?: string,
  ): Promise<void> {
    const signatureValid = this.koraClient.verifyWebhookSignature(
      webhook.data,
      signature,
    );

    try {
      await db.insert(paymentWebhook).values({
        provider: "kora",
        paymentReference:
          webhook.data.payment_reference || webhook.data.reference || null,
        eventType: webhook.event,
        signatureValid,
        payload: webhook,
        verificationNote: signatureValid
          ? "Webhook signature verified and queued"
          : "Webhook signature verification failed",
      });
    } catch (error) {
      this.capturePaymentException(error, "system", "storePaymentWebhookAudit", {
        event: webhook.event,
        paymentReference:
          webhook.data.payment_reference || webhook.data.reference || null,
      });
      logger.error("payment.webhook_audit_insert_failed", {
        event: webhook.event,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (!signatureValid) {
      logger.warn("payment.webhook_invalid_signature_ignored", {
        event: webhook.event,
        paymentReference:
          webhook.data.payment_reference || webhook.data.reference || null,
      });
      this.capturePaymentException(
        new Error("Invalid Kora webhook signature"),
        "system",
        "handleKoraWebhook",
        {
          event: webhook.event,
          paymentReference:
            webhook.data.payment_reference || webhook.data.reference || null,
        },
      );
      return;
    }

    const boss = await getBoss();
    await boss.send(QUEUES.PROCESS_WEBHOOK, {
      event: webhook.event,
      data: webhook.data,
      _retryCount: 0,
    });
  }

  async resolveReturnUrl(
    reference?: string | null,
    providerReturnStatus?: string | null,
  ) {
    const tripStatusUrl = `${this.config.frontendUrl}/trip-status`;

    if (!reference) {
      return tripStatusUrl;
    }

    const existingPayment = await this.getPaymentRecord(reference);
    if (!existingPayment) {
      return tripStatusUrl;
    }

    try {
      const normalizedReturnStatus = providerReturnStatus?.trim().toLowerCase();
      const verification = await this.koraClient.verifyTransaction(reference);
      this.logKoraVerificationResponse(
        "return_url",
        reference,
        verification.data,
      );
      const providerStatus = verification.data.status.toLowerCase();

      if (providerStatus === "success") {
        await this.confirmPendingPaymentSuccess(
          reference,
          verification.data,
          verification.raw,
        );

        return tripStatusUrl;
      }

      if (
        providerStatus === "failed" ||
        providerStatus === "cancelled" ||
        providerStatus === "abandoned" ||
        providerStatus === "closed"
      ) {
        await this.failPendingPayment(
          reference,
          providerStatus === "failed" ? "failed" : "cancelled",
          verification.data.message || "Payment was not completed",
          {
            failureCode:
              providerStatus === "failed" ? "PAYMENT_FAILED" : "USER_CANCELLED",
            providerStatus: verification.data.status,
            rawVerificationResponse: verification.raw,
          },
        );

        return tripStatusUrl;
      }

      if (
        normalizedReturnStatus &&
        ["failed", "cancelled", "abandoned", "closed"].includes(normalizedReturnStatus)
      ) {
        logger.info("payment.return_status_ignored_after_verification", {
          reference,
          providerReturnStatus: normalizedReturnStatus,
          verifiedStatus: verification.data.status,
        });
      }

      const hold = existingPayment.bookingId
        ? await this.getBookingHoldRecord(existingPayment.bookingId)
        : null;

      if (hold && hold.expiresAt.getTime() > Date.now()) {
        return tripStatusUrl;
      }

      await this.failPendingPayment(
        reference,
        "expired",
        "Seat reservation expired before payment was completed",
        {
          failureCode: "PAYMENT_EXPIRED",
          providerStatus: verification.data.status,
          rawVerificationResponse: verification.raw,
        },
      );

      return tripStatusUrl;
    } catch (error) {
      this.capturePaymentException(error, existingPayment.userId, "resolveReturnUrl", {
        reference,
      });
      logger.error("payment.return_verification_failed", {
        reference,
        error: error instanceof Error ? error.message : String(error),
      });

      return tripStatusUrl;
    }
  }

  async handleBookingCreated(payload: BookingCreatedEvent["payload"]) {
    return this.upsertBookingHold(payload);
  }

  async upsertBookingHold(payload: UpsertBookingHoldInput) {
    const holdExpiresAt = new Date(payload.expiresAt);

    const [hold] = await db
      .insert(bookingHold)
      .values({
        bookingId: payload.bookingId,
        tripId: payload.tripId,
        userId: payload.userId,
        fareAmount: payload.fareAmount,
        currency: payload.currency.toUpperCase(),
        expiresAt: holdExpiresAt,
        pgBossJobId: null,
      })
      .onConflictDoUpdate({
        target: bookingHold.bookingId,
        set: {
          tripId: payload.tripId,
          userId: payload.userId,
          fareAmount: payload.fareAmount,
          currency: payload.currency.toUpperCase(),
          expiresAt: holdExpiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    const existingPayment = await db.query.payment.findFirst({
      where: eq(payment.bookingId, payload.bookingId),
    });

    if (!existingPayment || existingPayment.status !== "pending" || hold?.pgBossJobId) {
      return;
    }

    await this.schedulePaymentExpiry(
      payload.bookingId,
      existingPayment.reference,
      hold?.expiresAt || holdExpiresAt,
    );
  }
}

export const paymentService = new PaymentService();
