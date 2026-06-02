import { randomUUID } from "node:crypto";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { renderEmail, getEmailSubject } from "@repo/email";
import { logger } from "../utils/logger";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import {
  booking,
  bookingHold,
  driver,
  earning,
  payment,
  paymentWebhook,
  route,
  trip,
  users,
} from "../db/index";
import { DriverService } from "../driver/driverService";
import { NotificationService } from "../notification/notificationService";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { PayoutService } from "../payout/payoutService";
import { jobService } from "../workers/jobService";
import type { WebhookJobData } from "../workers/boss";
import { KoraClient } from "./kora.client";
import type {
  InitializePaymentInput,
  KoraVerifyResponse,
  KoraWebhookPayload,
  PaymentStatus,
  UpsertBookingHoldInput,
} from "./payment.types";
import {
  assertCheckoutAmountWithinLimit,
  calculateTrustedChargeAmount,
  dedupeChannels,
  formatMajorAmount,
  formatTripDate,
  formatTripTime,
  getPaymentReference,
  parseDate,
  toMinorAmount,
} from "../utils/payment";

type PaymentRecord = typeof payment.$inferSelect;
type BookingRecord = typeof booking.$inferSelect;
type BookingHoldRecord = typeof bookingHold.$inferSelect;
type PaymentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type FailureStatus = Extract<PaymentStatus, "failed" | "cancelled" | "expired">;
type PaymentWithExpiry = PaymentRecord & { expiresAt?: Date | null };

const koraClient = new KoraClient();
const driverService = new DriverService();
const notificationService = new NotificationService();
const payoutService = new PayoutService();
const KORA_METADATA_KEY_REGEX = /^[A-Za-z0-9-]{1,20}$/;
const TERMINAL_PAYMENT_STATUSES = [
  "successful",
  "failed",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "refund_failed",
] as const;

export class PaymentService {
  private readonly config = getConfig();

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
    const entries: Array<[string, unknown]> = [["bookingId", input.bookingId]];
    if (input.metadata) {
      entries.push(...Object.entries(input.metadata));
    }

    const metadata: Record<string, string | number | boolean> = {};
    for (const [key, value] of entries) {
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
      } else if (typeof value === "number" && Number.isFinite(value)) {
        metadata[key] = value;
      } else if (typeof value === "boolean") {
        metadata[key] = value;
      }
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined;
  }

  private getPaymentPublicBaseUrl() {
    const configured =
      process.env.PAYMENT_PUBLIC_BASE_URL || this.config.KORA_WEBHOOK_URL;
    if (!configured) {
      throw createServiceError(
        "PAYMENT_PUBLIC_BASE_URL or KORA_WEBHOOK_URL must be configured",
        500,
      );
    }

    return configured
      .replace(/\/api\/v1\/payments\/webhooks\/kora$/, "")
      .replace(/\/api\/v1\/payments\/return$/, "")
      .replace(/\/api\/payments\/v1\/payments\/webhooks\/kora$/, "")
      .replace(/\/api\/payments\/v1\/payments\/return$/, "")
      .replace(/\/api\/payments\/webhooks\/kora$/, "")
      .replace(/\/api\/payments\/return$/, "")
      .replace(/\/$/, "");
  }

  private getReturnUrl(reference: string) {
    return `${this.getPaymentPublicBaseUrl()}/api/v1/payments/return?ref=${encodeURIComponent(reference)}`;
  }

  private getWebhookUrl() {
    return `${this.getPaymentPublicBaseUrl()}/api/v1/payments/webhooks/kora`;
  }

  private attachExpiry(
    paymentRecord: PaymentRecord,
    hold?: BookingHoldRecord | null,
  ): PaymentWithExpiry {
    return paymentRecord.bookingId
      ? { ...paymentRecord, expiresAt: hold?.expiresAt || null }
      : paymentRecord;
  }

  async withExpiry(
    paymentRecord: PaymentRecord,
    hold?: BookingHoldRecord | null,
  ): Promise<PaymentWithExpiry> {
    if (hold !== undefined) {
      return this.attachExpiry(paymentRecord, hold);
    }

    const resolvedHold = paymentRecord.bookingId
      ? await this.getBookingHoldRecord(paymentRecord.bookingId)
      : null;
    return this.attachExpiry(paymentRecord, resolvedHold);
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

  private async getBookingFareForCheckout(bookingId: string, userId: string) {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, bookingId),
    });

    if (!bookingRecord || bookingRecord.userId !== userId) {
      throw createServiceError("Booking not found", 404);
    }

    return {
      fareAmount: bookingRecord.fareAmount,
      currency: bookingRecord.currency.toUpperCase(),
    };
  }

  async initializePayment(
    userId: string,
    authenticatedEmail: string,
    input: InitializePaymentInput,
  ): Promise<PaymentWithExpiry | null> {
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
    const bookingFare = await this.getBookingFareForCheckout(
      input.bookingId,
      userId,
    );
    const trustedCurrency = bookingFare.currency;
    const trustedAmount = calculateTrustedChargeAmount(bookingFare.fareAmount);

    if (input.currency && input.currency.toUpperCase() !== trustedCurrency) {
      throw createServiceError(
        "Payment currency does not match booking currency",
        400,
      );
    }

    assertCheckoutAmountWithinLimit(trustedAmount);

    const initializeResponse = await koraClient.initializeTransaction({
      customer: {
        email: authenticatedEmail.trim(),
        name: input.customerName,
      },
      // Kora checkout pay-ins expect the major currency amount, not kobo/minor units.
      amount: trustedAmount,
      reference,
      currency: trustedCurrency,
      redirect_url: this.getReturnUrl(reference),
      notification_url: this.getWebhookUrl(),
      merchant_bears_cost: false,
      ...(channels ? { channels } : {}),
      metadata,
    });

    const insertedPayment = await db.transaction(async (tx) => {
      const [record] = await tx
        .insert(payment)
        .values({
          userId,
          bookingId: input.bookingId,
          provider: "kora",
          reference,
          amount: trustedAmount,
          currency: trustedCurrency,
          productName,
          customerName: this.sanitizeOptional(input.customerName),
          customerEmail: authenticatedEmail.trim(),
          status: "pending",
          providerStatus: "pending",
          checkoutUrl: initializeResponse.data.checkout_url,
          checkoutToken: initializeResponse.data.reference,
          channels,
          rawInitializeResponse: initializeResponse.raw,
          metadata,
        })
        .returning();

      await jobService.enqueuePaymentExpiry(
        tx,
        { bookingId: input.bookingId, reference },
        hold.expiresAt,
      );

      return record;
    });

    logger.info("payment.initialized", {
      bookingId: input.bookingId,
      reference,
    });

    return this.attachExpiry(insertedPayment, hold);
  }

  private async resolveExistingPendingCheckout(
    existingPayment: PaymentRecord,
    authenticatedEmail: string,
    input: InitializePaymentInput,
    hold: BookingHoldRecord,
  ) {
    const verification = await koraClient.verifyTransaction(
      existingPayment.reference,
    );
    const providerStatus = verification.data.status.toLowerCase();

    if (providerStatus === "success") {
      const confirmed = await this.confirmPendingPaymentSuccess(
        existingPayment.reference,
        verification.data,
        verification.raw,
      );
      return confirmed || this.withExpiry(existingPayment, hold);
    }

    if (["pending", "processing"].includes(providerStatus)) {
      return this.withExpiry(existingPayment, hold);
    }

    if (
      ["abandoned", "cancelled", "closed", "failed"].includes(providerStatus)
    ) {
      return this.refreshPendingCheckout(
        existingPayment,
        authenticatedEmail,
        input,
        hold,
        providerStatus,
      );
    }

    return this.withExpiry(existingPayment, hold);
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
    const bookingFare = await this.getBookingFareForCheckout(
      input.bookingId,
      existingPayment.userId,
    );
    const trustedCurrency = bookingFare.currency;
    const trustedAmount = calculateTrustedChargeAmount(bookingFare.fareAmount);

    if (input.currency && input.currency.toUpperCase() !== trustedCurrency) {
      throw createServiceError(
        "Payment currency does not match booking currency",
        400,
      );
    }

    assertCheckoutAmountWithinLimit(trustedAmount);

    logger.info("payment.checkout_retry_refreshing", {
      bookingId: existingPayment.bookingId,
      previousReference: existingPayment.reference,
      providerStatus,
    });

    const initializeResponse = await koraClient.initializeTransaction({
      customer: {
        email: authenticatedEmail.trim(),
        name: input.customerName || existingPayment.customerName || undefined,
      },
      // Kora checkout pay-ins expect the major currency amount, not kobo/minor units.
      amount: trustedAmount,
      reference,
      currency: trustedCurrency,
      redirect_url: this.getReturnUrl(reference),
      notification_url: this.getWebhookUrl(),
      merchant_bears_cost: false,
      ...(channels ? { channels } : {}),
      metadata,
    });

    const updatedPayment = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(payment)
        .set({
          reference,
          amount: trustedAmount,
          currency: trustedCurrency,
          productName,
          customerName: this.sanitizeOptional(
            input.customerName || existingPayment.customerName,
          ),
          customerEmail: authenticatedEmail.trim(),
          status: "pending",
          providerStatus: "pending",
          providerTransactionId: null,
          checkoutUrl: initializeResponse.data.checkout_url,
          checkoutToken: initializeResponse.data.reference,
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
        .where(
          and(
            eq(payment.id, existingPayment.id),
            eq(payment.status, "pending"),
          ),
        )
        .returning();

      if (record) {
        await jobService.enqueuePaymentExpiry(
          tx,
          { bookingId: input.bookingId, reference },
          hold.expiresAt,
        );
      }

      return record || null;
    });

    return updatedPayment
      ? this.withExpiry(updatedPayment, hold)
      : this.withExpiry(existingPayment, hold);
  }

  async upsertBookingHoldInTransaction(
    tx: PaymentTransaction,
    payload: UpsertBookingHoldInput,
  ) {
    const holdExpiresAt = new Date(payload.expiresAt);

    const [record] = await tx
      .insert(bookingHold)
      .values({
        bookingId: payload.bookingId,
        tripId: payload.tripId,
        userId: payload.userId,
        expiresAt: holdExpiresAt,
        pgBossJobId: null,
      })
      .onConflictDoUpdate({
        target: bookingHold.bookingId,
        set: {
          tripId: payload.tripId,
          userId: payload.userId,
          expiresAt: holdExpiresAt,
          updatedAt: new Date(),
        },
      })
      .returning();

    const existingPayment = await tx.query.payment.findFirst({
      where: eq(payment.bookingId, payload.bookingId),
    });

    if (existingPayment?.status === "pending") {
      await jobService.enqueuePaymentExpiry(
        tx,
        { bookingId: payload.bookingId, reference: existingPayment.reference },
        holdExpiresAt,
      );
    }

    return record;
  }

  async handleKoraWebhook(
    webhook: KoraWebhookPayload,
    signature?: string,
  ): Promise<void> {
    const signatureValid = koraClient.verifyWebhookSignature(
      webhook.data,
      signature,
    );

    await db.transaction(async (tx) => {
      await tx.insert(paymentWebhook).values({
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

      if (signatureValid) {
        await jobService.enqueuePaymentWebhook(tx, {
          event: webhook.event,
          data: webhook.data,
          _retryCount: 0,
        });
      }
    });

    if (!signatureValid) {
      logger.warn("payment.webhook_invalid_signature_ignored", {
        event: webhook.event,
        paymentReference:
          webhook.data.payment_reference || webhook.data.reference || null,
      });
      return;
    }
  }

  async processWebhookJob(job: WebhookJobData): Promise<void> {
    const reference = getPaymentReference(job);
    if (!reference) {
      logger.warn("payment.webhook_missing_reference", { event: job.event });
      return;
    }

    switch (job.event) {
      case "charge.success":
        await this.handleChargeSuccess(job, reference);
        return;
      case "charge.failed":
        await this.handleChargeFailed(reference);
        return;
      case "refund.success":
        await this.markRefundStatus(reference, "refunded");
        return;
      case "refund.failed":
        await this.markRefundStatus(reference, "refund_failed");
        return;
      default:
        logger.info("payment.webhook_ignored", { event: job.event, reference });
    }
  }

  private async handleChargeSuccess(job: WebhookJobData, reference: string) {
    const existingPayment = await this.getPaymentRecord(reference);
    if (existingPayment && existingPayment.status !== "pending") {
      if (
        existingPayment.status === "failed" ||
        existingPayment.status === "expired"
      ) {
        logger.info("payment.webhook_post_expiry_success", {
          reference,
          currentStatus: existingPayment.status,
        });

        const verification = await koraClient.verifyTransaction(reference);
        if (verification.data.status.toLowerCase() === "success") {
          await this.initiateAutoRefund(
            reference,
            verification.data,
            verification.raw,
            "Payment completed after booking hold expired",
          );
          return;
        }

        logger.warn("payment.webhook_success_mismatch", {
          koraStatus: verification.data.status,
          reference,
        });
      }

      logger.info("payment.webhook_duplicate_terminal", {
        event: job.event,
        reference,
      });
      return;
    }

    const verification = await koraClient.verifyTransaction(reference);
    if (verification.data.status.toLowerCase() !== "success") {
      logger.warn("payment.webhook_success_verification_mismatch", {
        koraStatus: verification.data.status,
        reference,
      });
      return;
    }

    if (!existingPayment) {
      logger.warn("payment.webhook_success_missing_payment", { reference });
      return;
    }

    const hold = existingPayment.bookingId
      ? await this.getBookingHoldRecord(existingPayment.bookingId)
      : null;

    if (!hold) {
      await this.initiateAutoRefund(
        reference,
        verification.data,
        verification.raw,
      );
      return;
    }

    if (hold.expiresAt.getTime() <= Date.now()) {
      await this.initiateAutoRefund(
        reference,
        verification.data,
        verification.raw,
      );
      return;
    }

    await this.confirmPendingPaymentSuccess(
      reference,
      verification.data,
      verification.raw,
    );
  }

  private async handleChargeFailed(reference: string) {
    const verification = await koraClient.verifyTransaction(reference);

    if (verification.data.status.toLowerCase() === "success") {
      await this.handleChargeSuccess(
        {
          event: "charge.success",
          data: { ...verification.data, reference },
          _retryCount: 0,
        },
        reference,
      );
      return;
    }

    await this.failPendingPayment(
      reference,
      "failed",
      verification.data.message || "Payment provider reported a failed charge",
      {
        failureCode: "PAYMENT_FAILED",
        providerStatus: verification.data.status,
        rawVerificationResponse: verification.raw,
      },
    );
  }

  async handlePaymentExpiry(payload: { bookingId: string; reference: string }) {
    // Atomically claim this payment for expiry processing — prevents race with concurrent webhook
    const [claimed] = await db
      .update(payment)
      .set({ lastStatusCheckAt: new Date() })
      .where(and(
        eq(payment.reference, payload.reference),
        eq(payment.status, "pending"),
      ))
      .returning();

    if (!claimed) {
      logger.info("payment.expire_skipped_concurrent", payload);
      return;
    }

    const verification = await koraClient.verifyTransaction(payload.reference);

    if (verification.data.status.toLowerCase() === "success") {
      const hold = await this.getBookingHoldRecord(payload.bookingId);
      if (hold && hold.expiresAt.getTime() > Date.now()) {
        await this.confirmPendingPaymentSuccess(
          payload.reference,
          verification.data,
          verification.raw,
        );
        return;
      }

      await this.failPendingPayment(
        payload.reference,
        "expired",
        "Payment completed after booking hold expired",
        {
          failureCode: "PAYMENT_EXPIRED",
          providerStatus: verification.data.status,
          rawVerificationResponse: verification.raw,
        },
      );
      await this.initiateAutoRefund(
        payload.reference,
        verification.data,
        verification.raw,
        "Payment completed after booking hold expired",
      );
      return;
    }

    await this.failPendingPayment(
      payload.reference,
      "expired",
      "Seat reservation expired before payment was completed",
      {
        failureCode: "PAYMENT_EXPIRED",
        providerStatus: verification.data.status,
        rawVerificationResponse: verification.raw,
      },
    );
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

    const paidAt =
      parseDate(verification.paid_at) ||
      parseDate(verification.transaction_date) ||
      new Date();
    const sideEffects = await this.buildBookingConfirmedSideEffects(
      existingPayment,
      verification,
      paidAt,
    );

    const result = await db.transaction(async (tx) => {
      const [updatedPayment] = await tx
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
        .where(
          and(eq(payment.reference, reference), eq(payment.status, "pending")),
        )
        .returning();

      if (!updatedPayment) {
        return null;
      }

      const bookingResult = await this.syncBookingPaymentStatusInTransaction(
        tx,
        {
          bookingId: updatedPayment.bookingId,
          paymentReference: reference,
          paymentStatus: "successful",
        },
      );

      if (bookingResult.confirmed && sideEffects) {
        await driverService.recordConfirmedBooking(tx, {
          driverId: sideEffects.driverId,
          fareAmountMinor: sideEffects.fareAmountMinor,
        });

        await payoutService.createEarningForConfirmedBookingInTransaction(tx, {
          bookingId: sideEffects.bookingId,
          tripId: sideEffects.tripId,
          routeId: sideEffects.routeId,
          driverId: sideEffects.driverId,
          tripDate: sideEffects.tripDate,
          pickupTitle: sideEffects.pickupTitle,
          dropoffTitle: sideEffects.dropoffTitle,
          fareAmountMinor: sideEffects.fareAmountMinor,
          currency: updatedPayment.currency,
          sourceEventId: `payment:${reference}:booking-confirmed`,
        });

        const notification =
          await notificationService.createForDriverInTransaction(
            tx,
            sideEffects.driverId,
            sideEffects.notification,
          );

        if (sideEffects.email.to) {
          await jobService.enqueueEmail(tx, "email.booking_confirmed", {
            to: sideEffects.email.to,
            subject: sideEffects.email.subject,
            html: sideEffects.email.html,
          });
        }

        await tx
          .delete(bookingHold)
          .where(eq(bookingHold.bookingId, sideEffects.bookingId));

        return { payment: updatedPayment, notification };
      }

      await tx
        .delete(bookingHold)
        .where(eq(bookingHold.bookingId, updatedPayment.bookingId || ""));

      return { payment: updatedPayment, notification: null };
    });

    if (!result) {
      const latest = await this.getPaymentRecord(reference);
      return latest ? this.withExpiry(latest) : null;
    }

    if (result.notification) {
      publishNotificationCreatedInBackground(result.notification);
    }

    logger.info("payment.confirmed", {
      bookingId: result.payment.bookingId,
      reference,
    });

    return this.withExpiry(result.payment, null);
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

    const cleanupProjection = options?.cleanupProjection ?? true;
    const [updatedPayment] = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(payment)
        .set({
          status: nextStatus,
          providerStatus:
            options?.providerStatus || existingPayment.providerStatus,
          rawVerificationResponse:
            options?.rawVerificationResponse ??
            existingPayment.rawVerificationResponse,
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

      if (!record) {
        return [];
      }

      await this.syncBookingPaymentStatusInTransaction(tx, {
        bookingId: record.bookingId,
        paymentReference: reference,
        paymentStatus: nextStatus,
      });

      if (cleanupProjection && record.bookingId) {
        await tx
          .delete(bookingHold)
          .where(eq(bookingHold.bookingId, record.bookingId));
      }

      return [record];
    });

    if (!updatedPayment) {
      const latest = await this.getPaymentRecord(reference);
      return latest ? this.withExpiry(latest) : null;
    }

    logger.info("payment.failed", {
      bookingId: updatedPayment.bookingId,
      reference,
      status: nextStatus,
    });

    return this.withExpiry(
      updatedPayment,
      cleanupProjection ? null : undefined,
    );
  }

  async initiateAutoRefund(
    reference: string,
    verification: Pick<
      KoraVerifyResponse,
      | "amount"
      | "currency"
      | "paid_at"
      | "payment_reference"
      | "reference"
      | "status"
    >,
    rawVerificationResponse: unknown,
    reason = "Seat reservation expired before payment was completed",
  ): Promise<PaymentWithExpiry | null> {
    const existingPayment = await this.getPaymentRecord(reference);
    if (!existingPayment || existingPayment.status !== "expired") {
      return existingPayment
        ? this.withExpiry(existingPayment)
        : null;
    }

    // Call Kora API FIRST — if this fails, DB state is unchanged (no stuck refund_pending)
    let refundResult: Awaited<ReturnType<typeof koraClient.initiateRefund>>;
    try {
      refundResult = await koraClient.initiateRefund({
        reference: `RFD-${existingPayment.reference}`,
        payment_reference: existingPayment.reference,
        reason,
      });
    } catch (error) {
      await db.transaction(async (tx) => {
        await tx
          .update(payment)
          .set({ status: "refund_failed", updatedAt: new Date() })
          .where(and(
            eq(payment.id, existingPayment.id),
            inArray(payment.status, ["pending", "successful", "failed", "expired"]),
          ));

        if (existingPayment.bookingId) {
          await tx
            .update(booking)
            .set({ paymentStatus: "refund_failed", updatedAt: new Date() })
            .where(eq(booking.id, existingPayment.bookingId));
        }
      });

      await this.enqueueRefundFailureEmail(existingPayment, reason);
      throw error;
    }

    // THEN update DB state inside transaction
    const [updatedPayment] = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(payment)
        .set({
          status: "refund_pending",
          failureCode: "AUTO_REFUND_INITIATED",
          failureReason: reason,
          updatedAt: new Date(),
          metadata: sql`COALESCE(${payment.metadata},'{}'::jsonb)||${JSON.stringify({
            refundReference: refundResult.data.reference,
            refundStatus: refundResult.data.status,
            refundInitiatedAt: new Date().toISOString(),
            rawRefundResponse: refundResult.raw,
          })}::jsonb`,
        })
        .where(
          and(
            eq(payment.reference, reference),
            eq(payment.status, "expired"),
          ),
        )
        .returning();

      if (!record || !record.bookingId) {
        return [];
      }

      const bookingResult = await this.syncBookingPaymentStatusInTransaction(tx, {
        bookingId: record.bookingId,
        paymentReference: reference,
        paymentStatus: "expired",
      });

      if (record.bookingId) {
        const earningRecord = await tx.query.earning.findFirst({
          where: eq(earning.bookingId, record.bookingId),
        });

        await tx
          .delete(bookingHold)
          .where(eq(bookingHold.bookingId, record.bookingId));

        await tx
          .update(earning)
          .set({
            status: "cancelled",
            updatedAt: new Date(),
          })
          .where(eq(earning.bookingId, record.bookingId));

        if (bookingResult.cancelledConfirmed && bookingResult.booking) {
          await this.recordConfirmedBookingCancelledStats(
            tx,
            bookingResult.booking,
            earningRecord,
          );
        } else if (earningRecord) {
          await driverService.recordEarningStatusChanged(tx, {
            driverId: earningRecord.driverId,
            amountMinor: earningRecord.netAmountMinor,
            previousStatus: earningRecord.status,
            nextStatus: "cancelled",
          });
        }
      }

      return [record];
    });

    if (!updatedPayment) {
      // Refund was initiated at provider but DB update failed — log for reconciliation
      logger.error("payment.auto_refund_db_failed_after_api", { reference });
      return null;
    }

    logger.info("payment.auto_refund_initiated", {
      reference,
      amount: existingPayment.amount,
    });

    return this.withExpiry(updatedPayment);
  }

  private async recordConfirmedBookingCancelledStats(
    tx: PaymentTransaction,
    bookingRecord: BookingRecord,
    existingEarning?: typeof earning.$inferSelect | null,
  ) {
    const earningRecord =
      existingEarning ??
      (await tx.query.earning.findFirst({
        where: eq(earning.bookingId, bookingRecord.id),
      }));
    const driverId =
      earningRecord?.driverId ??
      (
        await tx.query.trip.findFirst({
          where: eq(trip.id, bookingRecord.tripId),
          columns: { driverId: true },
        })
      )?.driverId;

    if (!driverId) {
      return;
    }

    await driverService.recordConfirmedBookingCancelled(tx, {
      driverId,
      amountMinor:
        earningRecord?.netAmountMinor ?? toMinorAmount(bookingRecord.fareAmount),
      previousEarningStatus: earningRecord?.status ?? null,
    });
  }

  async resolveReturnUrl(
    reference?: string | null,
    providerReturnStatus?: string | null,
  ) {
    const tripStatusUrl = `${this.config.FRONTEND_URL}/trip-status`;
    if (!reference) {
      return tripStatusUrl;
    }

    const existingPayment = await this.getPaymentRecord(reference);
    if (!existingPayment) {
      return tripStatusUrl;
    }

    try {
      const verification = await koraClient.verifyTransaction(reference);
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
        ["failed", "cancelled", "abandoned", "closed"].includes(providerStatus)
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

      const normalizedReturnStatus = providerReturnStatus?.trim().toLowerCase();
      if (
        normalizedReturnStatus &&
        ["failed", "cancelled", "abandoned", "closed"].includes(
          normalizedReturnStatus,
        )
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
    } catch (error) {
      logger.error("payment.return_verification_failed", {
        reference,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return tripStatusUrl;
  }

  async getPaymentStatus(reference: string) {
    const record = await this.getPaymentRecord(reference);
    if (!record) {
      throw createServiceError("Payment not found", 404);
    }

    return this.withExpiry(record);
  }

  private async syncBookingPaymentStatusInTransaction(
    tx: PaymentTransaction,
    input: {
      bookingId?: string | null;
      paymentReference: string;
      paymentStatus:
        | "initialized"
        | "pending"
        | "successful"
        | "failed"
        | "cancelled"
        | "expired";
    },
  ) {
    if (!input.bookingId) {
      return {
        booking: null,
        confirmed: false,
        cancelled: false,
        cancelledConfirmed: false,
      };
    }

    const existingBooking = await tx.query.booking.findFirst({
      where: eq(booking.id, input.bookingId),
    });

    if (!existingBooking) {
      return {
        booking: null,
        confirmed: false,
        cancelled: false,
        cancelledConfirmed: false,
      };
    }

    const nextBookingStatus =
      input.paymentStatus === "successful"
        ? "confirmed"
        : input.paymentStatus === "failed" ||
            input.paymentStatus === "cancelled" ||
            input.paymentStatus === "expired"
          ? "cancelled"
          : "pending";
    const isCancellingTransition =
      nextBookingStatus === "cancelled" &&
      existingBooking.status !== "cancelled";
    const isCancellingConfirmedBooking =
      isCancellingTransition && existingBooking.status === "confirmed";
    const shouldConfirm =
      input.paymentStatus === "successful" &&
      nextBookingStatus === "confirmed" &&
      existingBooking.status !== "confirmed";

    const updatePayload: {
      status?: "completed" | "cancelled" | "pending" | "confirmed";
      paymentReference: string;
      paymentStatus: string;
      updatedAt: Date;
      seatNumber?: number | null;
    } = {
      paymentReference: input.paymentReference,
      paymentStatus: input.paymentStatus,
      updatedAt: new Date(),
    };

    if (
      !(
        (existingBooking.status === "confirmed" &&
          nextBookingStatus !== "confirmed") ||
        (existingBooking.status === "cancelled" &&
          nextBookingStatus === "pending")
      )
    ) {
      updatePayload.status = nextBookingStatus;
    }

    if (isCancellingTransition) {
      updatePayload.seatNumber = null;
      await tx
        .update(trip)
        .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
        .where(
          and(eq(trip.id, existingBooking.tripId), gt(trip.bookedSeats, 0)),
        );
    }

    const [updatedBooking] = await tx
      .update(booking)
      .set(updatePayload)
      .where(eq(booking.id, input.bookingId))
      .returning();

    return {
      booking: updatedBooking,
      confirmed: shouldConfirm,
      cancelled: isCancellingTransition,
      cancelledConfirmed: isCancellingConfirmedBooking,
    };
  }

  private async buildBookingConfirmedSideEffects(
    paymentRecord: PaymentRecord,
    verification: KoraVerifyResponse,
    paidAt: Date,
  ) {
    if (!paymentRecord.bookingId) {
      return null;
    }

    const [bookingDetails] = await db
      .select({
        booking: booking,
        trip: trip,
        route: route,
        passenger: users,
        driver: driver,
      })
      .from(booking)
      .innerJoin(trip, eq(trip.id, booking.tripId))
      .innerJoin(route, eq(route.id, trip.routeId))
      .leftJoin(users, eq(users.id, booking.userId))
      .leftJoin(driver, eq(driver.id, trip.driverId))
      .where(eq(booking.id, paymentRecord.bookingId));

    if (!bookingDetails) {
      return null;
    }

    const bookingRecord = bookingDetails.booking;
    const tripRecord = bookingDetails.trip;
    const routeRecord = bookingDetails.route;
    const passenger = bookingDetails.passenger;
    const driverRecord = bookingDetails.driver;
    const passengerName = passenger
      ? `${passenger.firstName} ${passenger.lastName}`.trim()
      : null;
    const tripDateLabel = formatTripDate(tripRecord.date);
    const departureTimeLabel = formatTripTime(routeRecord.departure_time);
    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      passengerName,
      paymentReference: paymentRecord.reference,
      pricePaid: formatMajorAmount(
        paymentRecord.amount,
        paymentRecord.currency,
      ),
      pickupTitle: routeRecord.pickup_location_title,
      dropoffTitle: routeRecord.dropoff_location_title,
      tripDate: tripDateLabel,
      departureTime: departureTimeLabel,
      timeZone: this.config.ROUTE_SERVICE_TIMEZONE,
      vehicleType: routeRecord.vehicleType,
      seatNumber: bookingRecord.seatNumber ?? 0,
      meetingPoint: routeRecord.meeting_point,
      driverName: driverRecord
        ? `${driverRecord.firstName} ${driverRecord.lastName}`.trim()
        : null,
      driverPhone: driverRecord?.phone || null,
    });
    const html = await renderEmail("BookingConfirmedEmail", propsJson);

    return {
      bookingId: bookingRecord.id,
      tripId: tripRecord.id,
      routeId: routeRecord.id,
      driverId: tripRecord.driverId,
      fareAmountMinor: toMinorAmount(bookingRecord.fareAmount),
      tripDate: tripRecord.date,
      departureTime: routeRecord.departure_time,
      pickupTitle: routeRecord.pickup_location_title,
      dropoffTitle: routeRecord.dropoff_location_title,
      notification: {
        notificationKey: `event:${paymentRecord.reference}:booking-confirmed`,
        kind: "event" as const,
        type: "booking_confirmed",
        title: "New booking confirmed",
        message: passengerName
          ? `This trip was booked by ${passengerName} for ${tripDateLabel} at ${departureTimeLabel}.`
          : `This trip was booked for ${tripDateLabel} at ${departureTimeLabel}.`,
        href: "/routes",
        tag: "Booking",
        tone: "positive" as const,
        metadata: {
          bookingId: bookingRecord.id,
          tripId: tripRecord.id,
          routeId: routeRecord.id,
          paymentReference: paymentRecord.reference,
          providerPaymentReference: verification.payment_reference || null,
        },
        occurredAt: paidAt,
      },
      email: {
        to: paymentRecord.customerEmail || passenger?.email || "",
        subject: getEmailSubject("BookingConfirmedEmail", propsJson),
        html,
      },
    };
  }

  private async enqueueRefundFailureEmail(
    paymentRecord: PaymentRecord,
    failureReason: string,
  ) {
    if (!paymentRecord.customerEmail) {
      return;
    }

    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName: paymentRecord.customerName || null,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      bookingId: paymentRecord.bookingId,
      amountMinor: toMinorAmount(paymentRecord.amount),
      currency: paymentRecord.currency,
      productName: paymentRecord.productName,
      failureReason,
      supportEmail: "support@dailyexpress.app",
      supportPhone: "+234 9063611541",
    });
    const html = await renderEmail("RefundFailedEmail", propsJson);

    await db.transaction(async (tx) => {
      await jobService.enqueueEmail(tx, "email.refund_failed", {
        to: paymentRecord.customerEmail || "",
        subject: getEmailSubject("RefundFailedEmail", propsJson),
        html,
      });
    });
  }

  private async markRefundStatus(
    reference: string,
    status: "refunded" | "refund_failed",
  ) {
    await db.transaction(async (tx) => {
      await tx
        .update(payment)
        .set({
          status,
          updatedAt: new Date(),
          metadata: sql`COALESCE(${payment.metadata},'{}'::jsonb)||${JSON.stringify({
            refundCompletedAt: new Date().toISOString(),
            refundFinalStatus: status,
          })}::jsonb`,
        })
        .where(eq(payment.reference, reference));

      const [bookingRecord] = await tx
        .update(booking)
        .set({ paymentStatus: status, updatedAt: new Date() })
        .where(eq(booking.paymentReference, reference))
        .returning();

      if (
        bookingRecord &&
        bookingRecord.status === "confirmed" &&
        bookingRecord.seatNumber !== null
      ) {
        const earningRecord = await tx.query.earning.findFirst({
          where: eq(earning.bookingId, bookingRecord.id),
        });

        await tx
          .update(earning)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(earning.bookingId, bookingRecord.id));

        if (status === "refunded") {
          await this.recordConfirmedBookingCancelledStats(
            tx,
            bookingRecord,
            earningRecord,
          );
        } else if (earningRecord) {
          await driverService.recordEarningStatusChanged(tx, {
            driverId: earningRecord.driverId,
            amountMinor: earningRecord.netAmountMinor,
            previousStatus: earningRecord.status,
            nextStatus: "cancelled",
          });
        }

        await tx
          .update(trip)
          .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
          .where(eq(trip.id, bookingRecord.tripId));
      }
    });
  }

  isTerminalStatus(status: PaymentStatus) {
    return (TERMINAL_PAYMENT_STATUSES as readonly string[]).includes(status);
  }
}

export const paymentService = new PaymentService();
