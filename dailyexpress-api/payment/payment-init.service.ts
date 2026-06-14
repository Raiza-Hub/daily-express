import { createServiceError, sanitizeInput } from "@shared/utils";
import { and, eq } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { booking, payment } from "../db/index";
import { logger } from "../utils/logger";
import {
    assertCheckoutAmountWithinLimit,
    calculateTrustedChargeAmount,
    dedupeChannels,
    generateReference,
} from "../utils/payment";
import { jobService } from "../workers/jobService";
import { KoraClient } from "./kora.client";
import { PaymentConfirmService } from "./payment-confirm.service";
import { PaymentRepository } from "./payment.repository";
import type {
    InitializePaymentInput,
    KoraChannel
} from "./payment.types";
import { enrichWithExpiry } from "./payment.utils";

type PaymentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymentRecord = typeof payment.$inferSelect;

const KORA_METADATA_KEY_REGEX = /^[A-Za-z0-9-]{1,20}$/;

export class PaymentInitService {
  private readonly config = getConfig();
  private readonly kora = new KoraClient();

  constructor(
    private repo: PaymentRepository,
    private confirmService: PaymentConfirmService,
  ) {}

  async initializePayment(
    userId: string,
    authenticatedEmail: string,
    input: InitializePaymentInput,
  ) {
    const bookingRecord = await db.query.booking.findFirst({
      where: eq(booking.id, input.bookingId),
    });
    if (!bookingRecord) {
      throw createServiceError("Booking not found", 404);
    }

    if (
      !bookingRecord.expiresAt ||
      bookingRecord.expiresAt.getTime() <= Date.now()
    ) {
      throw createServiceError(
        "Seat reservation has expired - cannot initialize payment",
        400,
      );
    }

    if (bookingRecord.userId !== userId) {
      throw createServiceError("Booking not found", 404);
    }

    const existingPayment = await this.repo.findPaymentByBookingId(
      input.bookingId,
    );

    if (existingPayment && existingPayment.userId !== userId) {
      throw createServiceError("Booking not found", 404);
    }

    if (existingPayment?.status === "pending") {
      return this.resolveExistingPendingCheckout(
        existingPayment,
        authenticatedEmail,
        input,
        bookingRecord.expiresAt,
      );
    }

    if (existingPayment) {
      return enrichWithExpiry(existingPayment, bookingRecord.expiresAt);
    }

    const reference = this.buildReference(input.reference);
    const channels = dedupeChannels(input.channels);
    const metadata = this.buildMetadata(input);
    const productName = sanitizeInput(input.productName);
    const bookingFare = await this.repo.findBookingFareByBookingId(
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

    const initializeResponse = await this.createKoraCheckoutSession({
      email: authenticatedEmail.trim(),
      customerName: input.customerName,
      amount: trustedAmount,
      reference,
      currency: trustedCurrency,
      channels,
      metadata,
    });

    const insertedPayment = await db.transaction(async (tx) => {
      const [record] = await this.repo.insertPayment(tx, {
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
      });

      await jobService.enqueuePaymentExpiry(
        tx,
        { bookingId: input.bookingId, reference },
        bookingRecord.expiresAt!,
      );

      return record;
    });

    logger.info("payment.initialized", {
      bookingId: input.bookingId,
      reference,
    });

    return enrichWithExpiry(insertedPayment, bookingRecord.expiresAt);
  }

  private async resolveExistingPendingCheckout(
    existingPayment: PaymentRecord,
    authenticatedEmail: string,
    input: InitializePaymentInput,
    expiresAt: Date,
  ) {
    const verification = await this.kora.verifyTransaction(
      existingPayment.reference,
    );
    const providerStatus = verification.data.status.toLowerCase();

    if (providerStatus === "success") {
      const confirmed = await this.confirmService.confirmPayment(
        existingPayment.reference,
        verification.data,
        verification.raw,
      );
      return confirmed || enrichWithExpiry(existingPayment, expiresAt);
    }

    if (["pending", "processing"].includes(providerStatus)) {
      return enrichWithExpiry(existingPayment, expiresAt);
    }

    if (
      ["abandoned", "cancelled", "closed", "failed"].includes(providerStatus)
    ) {
      return this.reinitializePayment(
        existingPayment,
        authenticatedEmail,
        input,
        expiresAt,
        providerStatus,
      );
    }

    return enrichWithExpiry(existingPayment, expiresAt);
  }

  private async reinitializePayment(
    existingPayment: PaymentRecord,
    authenticatedEmail: string,
    input: InitializePaymentInput,
    expiresAt: Date,
    providerStatus: string,
  ) {
    const reference = this.buildReference();
    const channels = dedupeChannels(input.channels);
    const metadata = this.buildMetadata(input);
    const productName = sanitizeInput(input.productName);
    const bookingFare = await this.repo.findBookingFareByBookingId(
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

    const initializeResponse = await this.createKoraCheckoutSession({
      email: authenticatedEmail.trim(),
      customerName: input.customerName || existingPayment.customerName || undefined,
      amount: trustedAmount,
      reference,
      currency: trustedCurrency,
      channels,
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
          and(eq(payment.id, existingPayment.id), eq(payment.status, "pending")),
        )
        .returning();

      if (record) {
        await jobService.enqueuePaymentExpiry(
          tx,
          { bookingId: input.bookingId, reference },
          expiresAt,
        );
      }

      return record || null;
    });

    return updatedPayment
      ? enrichWithExpiry(updatedPayment, expiresAt)
      : enrichWithExpiry(existingPayment, expiresAt);
  }

  private async createKoraCheckoutSession(params: {
    email: string;
    customerName?: string;
    amount: number;
    reference: string;
    currency: string;
    channels?: KoraChannel[] | null;
    metadata?: Record<string, string | number | boolean> | undefined;
  }) {
    return this.kora.initializeTransaction({
      customer: {
        email: params.email,
        name: params.customerName,
      },
      amount: params.amount,
      reference: params.reference,
      currency: params.currency,
      redirect_url: this.getReturnUrl(params.reference),
      notification_url: this.getWebhookUrl(),
      merchant_bears_cost: false,
      ...(params.channels ? { channels: params.channels } : {}),
      ...(params.metadata ? { metadata: params.metadata } : {}),
    });
  }

  private buildReference(reference?: string) {
    return reference?.trim() || generateReference();
  }

  private sanitizeOptional(value?: string | null) {
    if (!value) return null;
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

}
