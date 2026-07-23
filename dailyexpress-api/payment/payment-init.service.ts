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
import { jobService } from "../workers/job.service";
import { koraClient } from "./kora.client";
import { PaymentRepository, paymentRepository } from "./payment.repository";
import type {
    InitializePaymentInput,
    KoraChannel,
    KoraInitializeResponse,
    PaymentTransaction,
} from "./payment.types";
import type { PaymentRecord } from "../db/index";
import { enrichWithExpiry } from "./payment.utils";



export class PaymentInitService {
  private readonly config = getConfig();
  private readonly kora = koraClient;

  constructor(
    private repo: PaymentRepository,
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

    if (bookingRecord.userId !== userId) {
      throw createServiceError("Booking not found", 404);
    }

    // 1. If another request is currently initializing this payment, return the existing payment record (conflict handling)
    let existingPayment = await this.repo.findPaymentByBookingId(input.bookingId);
    if (existingPayment?.status === "initialized") {
      logger.info("payment.initialize_conflict_skipped", {
        bookingId: input.bookingId,
      });
      return enrichWithExpiry(existingPayment, bookingRecord.expiresAt);
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
    const productName = sanitizeInput(input.productName);
    const bookingFare = await this.repo.findBookingFareByBookingId(
      input.bookingId,
      userId,
    );
    const trustedCurrency = bookingFare.currency;
    const trustedAmount = calculateTrustedChargeAmount(bookingFare.fareAmount, bookingFare.feeAmount);

    assertCheckoutAmountWithinLimit(trustedAmount);

    // 2. Pre-insert the payment with status 'initialized' under row lock to claim checkout session creation
    const setupResult = await db.transaction(async (tx) => {
      const [lockedBooking] = await tx
        .select()
        .from(booking)
        .where(eq(booking.id, input.bookingId))
        .for("update")
        .limit(1);

      if (!lockedBooking) {
        throw createServiceError("Booking not found", 404);
      }

      if (
        !lockedBooking.expiresAt ||
        lockedBooking.expiresAt.getTime() <= Date.now()
      ) {
        throw createServiceError(
          "Seat reservation has expired - cannot initialize payment",
          400,
        );
      }

      const currentPayment = await tx.query.payment.findFirst({
        where: eq(payment.bookingId, input.bookingId),
      });

      if (currentPayment?.status === "pending") {
        return { action: "return_pending" as const, payment: currentPayment };
      }

      if (currentPayment) {
        return { action: "return_existing" as const, payment: currentPayment };
      }

      const [inserted] = await tx
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
          status: "initialized",
          providerStatus: "pending",
          channels,
        })
        .onConflictDoNothing({ target: payment.bookingId })
        .returning();

      if (inserted) {
        return { action: "call_kora" as const, payment: inserted };
      } else {
        const existing = await tx.query.payment.findFirst({
          where: eq(payment.bookingId, input.bookingId),
        });
        if (existing) {
          return { action: "return_existing" as const, payment: existing };
        }
        throw new Error("Payment conflict occurred but existing record not found");
      }
    });

    if (setupResult.action === "return_pending") {
      return this.resolveExistingPendingCheckout(
        setupResult.payment,
        authenticatedEmail,
        input,
        bookingRecord.expiresAt,
      );
    }

    if (setupResult.action === "return_existing") {
      return enrichWithExpiry(setupResult.payment, bookingRecord.expiresAt);
    }

    // 3. call Kora checkout API outside the transaction
    let initializeResponse: { data: KoraInitializeResponse; raw: unknown };
    try {
      initializeResponse = await this.createKoraCheckoutSession({
        email: authenticatedEmail.trim(),
        customerName: input.customerName,
        amount: trustedAmount,
        reference,
        currency: trustedCurrency,
        channels,
      });
    } catch (koraError) {
      await db.transaction(async (tx) => {
        await tx
          .delete(payment)
          .where(eq(payment.id, setupResult.payment.id));
      });
      throw koraError;
    }

    // 4. finalize the payment to pending and enqueue expiry
    const finalPayment = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(payment)
        .set({
          status: "pending",
          checkoutUrl: initializeResponse.data.checkout_url,
          checkoutToken: initializeResponse.data.reference,
          rawInitializeResponse: initializeResponse.raw,
          updatedAt: new Date(),
        })
        .where(eq(payment.id, setupResult.payment.id))
        .returning();

      if (updated) {
        await jobService.enqueuePaymentExpiry(
          tx,
          { bookingId: input.bookingId, reference },
          bookingRecord.expiresAt!,
        );
      }

      return updated || setupResult.payment;
    });

    logger.info("payment.initialized", {
      bookingId: input.bookingId,
      reference,
    });

    return enrichWithExpiry(finalPayment, bookingRecord.expiresAt);
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
      await db.transaction(async (tx) => {
        await jobService.enqueue(tx, "allocation.process", {
          bookingId: existingPayment.bookingId,
          reference: existingPayment.reference,
        });
      });
      return enrichWithExpiry(existingPayment, expiresAt);
    }

    if (["pending", "processing"].includes(providerStatus)) {
      if (!existingPayment.bookingId) return null;
      const bookingFare = await this.repo.findBookingFareByBookingId(
        existingPayment.bookingId,
        existingPayment.userId,
      );
      const expectedAmount = calculateTrustedChargeAmount(bookingFare.fareAmount, bookingFare.feeAmount);

      if (expectedAmount !== existingPayment.amount) {
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
    const productName = sanitizeInput(input.productName);
    const bookingFare = await this.repo.findBookingFareByBookingId(
      input.bookingId,
      existingPayment.userId,
    );
    const trustedCurrency = bookingFare.currency;
    const trustedAmount = calculateTrustedChargeAmount(bookingFare.fareAmount, bookingFare.feeAmount);

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

    const result = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(payment)
        .where(eq(payment.id, existingPayment.id))
        .for("update")
        .limit(1);

      if (!locked || locked.status !== "pending") return null;

      const [updated] = await tx
        .update(payment)
        .set({
          status: "initialized",
          updatedAt: new Date(),
        })
        .where(eq(payment.id, existingPayment.id))
        .returning();

      return updated;
    });

    if (!result) {
      const reloaded = await this.repo.findPaymentByBookingId(input.bookingId);
      return enrichWithExpiry(reloaded || existingPayment, expiresAt);
    }

    let initializeResponse: { data: KoraInitializeResponse; raw: unknown };
    try {
      initializeResponse = await this.createKoraCheckoutSession({
        email: authenticatedEmail.trim(),
        customerName: input.customerName || existingPayment.customerName || undefined,
        amount: trustedAmount,
        reference,
        currency: trustedCurrency,
        channels,
      });
    } catch (koraError) {
      await db
        .update(payment)
        .set({
          status: "failed",
          failureReason: koraError instanceof Error ? koraError.message : "Checkout retry re-initialization failed",
          updatedAt: new Date(),
        })
        .where(eq(payment.id, existingPayment.id));
      throw koraError;
    }

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
          checkoutUrl: initializeResponse.data.checkout_url,
          checkoutToken: initializeResponse.data.reference,
          channels,
          rawInitializeResponse: initializeResponse.raw,
          lastStatusCheckAt: new Date(),
          paidAt: null,
          failedAt: null,
          failureCode: null,
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(eq(payment.id, existingPayment.id))
        .returning();

      if (record) {
        await jobService.enqueuePaymentExpiry(
          tx,
          { bookingId: input.bookingId, reference },
          expiresAt,
        );
      }

      return record;
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
    });
  }

  private buildReference(reference?: string) {
    return reference?.trim() || generateReference();
  }

  private sanitizeOptional(value?: string | null) {
    if (!value) return null;
    return sanitizeInput(value);
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

export const paymentInitService = new PaymentInitService(paymentRepository);
