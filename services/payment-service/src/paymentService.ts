import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/db";
import { payment, paymentWebhook } from "../db/schema";
import { createServiceError, sanitizeInput } from "@shared/utils";
import { loadConfig } from "./config";
import {
  PaystackClient,
  mapPaystackStatusToPaymentStatus,
  verifyPaystackWebhookSignature,
} from "./paystack.client";
import { emitPaymentCompleted, emitPaymentFailed } from "./kafka/producer";
import type {
  InitializePaymentInput,
  PaystackChannel,
  PaystackWebhookPayload,
  PaystackVerifyResponse,
  PaymentStatus,
} from "./types";

type PaymentRecord = typeof payment.$inferSelect;

function isTerminalStatus(status: PaymentStatus) {
  return (
    status === "successful" ||
    status === "failed" ||
    status === "cancelled" ||
    status === "expired"
  );
}

function resolveNextStatus(
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus,
): PaymentStatus {
  if (currentStatus === "successful") {
    return currentStatus;
  }

  if (isTerminalStatus(currentStatus) && nextStatus === "pending") {
    return currentStatus;
  }

  return nextStatus;
}

function dedupeChannels(channels?: PaystackChannel[]) {
  if (!channels?.length) {
    return null;
  }

  const uniqueChannels: PaystackChannel[] = [];

  for (const channel of channels) {
    if (!uniqueChannels.includes(channel)) {
      uniqueChannels.push(channel);
    }
  }

  return uniqueChannels;
}

export class PaymentService {
  private readonly config = loadConfig();
  private readonly paystackClient = new PaystackClient();
  private readonly kafkaEnabled = process.env.KAFKA_ENABLED !== "false";

  private buildReference(reference?: string) {
    return reference?.trim() || `DX-${Date.now()}-${randomUUID().slice(0, 8)}`;
  }

  private sanitizeOptional(value?: string | null) {
    if (!value) {
      return null;
    }

    return sanitizeInput(value);
  }

  private getRequiredUrls(input: InitializePaymentInput) {
    const redirectUrl = input.redirectUrl || this.config.defaultRedirectUrl;
    const cancelUrl = input.cancelUrl || this.config.defaultCancelUrl;

    if (!redirectUrl) {
      throw createServiceError("redirectUrl is required", 400);
    }

    return {
      redirectUrl,
      cancelUrl: cancelUrl || undefined,
    };
  }

  private buildMetadata(input: InitializePaymentInput, cancelUrl?: string) {
    return {
      ...(input.metadata || {}),
      ...(input.bookingId ? { bookingId: input.bookingId } : {}),
      ...(cancelUrl ? { cancel_action: cancelUrl } : {}),
    };
  }

  private getVerificationFailure(
    existingPayment: PaymentRecord,
    verification: Pick<PaystackVerifyResponse, "amount" | "currency">,
  ) {
    if (verification.amount !== existingPayment.amountMinor) {
      return {
        failureCode: "amount_mismatch",
        failureReason: "Verified payment amount does not match the booking total",
      };
    }

    if (verification.currency.toUpperCase() !== existingPayment.currency) {
      return {
        failureCode: "currency_mismatch",
        failureReason:
          "Verified payment currency does not match the booking currency",
      };
    }

    return null;
  }

  private async emitPaymentStatusEvent(
    previousStatus: PaymentStatus,
    paymentRecord: PaymentRecord,
  ) {
    if (
      !this.kafkaEnabled ||
      !paymentRecord.bookingId ||
      previousStatus === paymentRecord.status
    ) {
      return;
    }

    if (paymentRecord.status === "successful") {
      await emitPaymentCompleted({
        paymentId: paymentRecord.id,
        bookingId: paymentRecord.bookingId,
        paymentReference: paymentRecord.reference,
      });
      return;
    }

    if (
      paymentRecord.status === "failed" ||
      paymentRecord.status === "cancelled" ||
      paymentRecord.status === "expired"
    ) {
      await emitPaymentFailed({
        paymentId: paymentRecord.id,
        bookingId: paymentRecord.bookingId,
        paymentReference: paymentRecord.reference,
        paymentStatus: paymentRecord.status,
        failureReason: paymentRecord.failureReason,
      });
    }
  }

  private async updatePaymentFromVerification(
    existingPayment: PaymentRecord,
    verification: PaystackVerifyResponse,
    rawResponse: unknown,
  ) {
    const verifiedStatus = mapPaystackStatusToPaymentStatus(verification.status);
    const verificationFailure =
      verifiedStatus === "successful"
        ? this.getVerificationFailure(existingPayment, verification)
        : null;
    const nextStatus = resolveNextStatus(
      existingPayment.status,
      verificationFailure ? "failed" : verifiedStatus,
    );
    const updatePayload: Partial<typeof payment.$inferInsert> = {
      providerTransactionId:
        String(verification.id) || existingPayment.providerTransactionId,
      providerStatus: verification.status,
      status: nextStatus,
      rawVerificationResponse: rawResponse,
      lastStatusCheckAt: new Date(),
      updatedAt: new Date(),
      failureCode:
        verificationFailure?.failureCode ||
        (nextStatus === "failed" ? "payment_failed" : null),
      failureReason:
        verificationFailure?.failureReason ||
        verification.gateway_response ||
        null,
    };

    if (nextStatus === "successful" && !existingPayment.paidAt) {
      updatePayload.paidAt = verification.paid_at
        ? new Date(verification.paid_at)
        : new Date();
      updatePayload.failedAt = null;
    }

    if (
      (nextStatus === "failed" || nextStatus === "cancelled") &&
      !existingPayment.failedAt
    ) {
      updatePayload.failedAt = new Date();
    }

    const [updatedPayment] = await db
      .update(payment)
      .set(updatePayload)
      .where(eq(payment.id, existingPayment.id))
      .returning();

    await this.emitPaymentStatusEvent(existingPayment.status, updatedPayment);

    return updatedPayment;
  }

  async initializePayment(
    userId: string,
    authenticatedEmail: string,
    input: InitializePaymentInput,
  ) {
    const reference = this.buildReference(input.reference);
    const urls = this.getRequiredUrls(input);
    const channels = dedupeChannels(input.channels);
    const existingPayment = await db.query.payment.findFirst({
      where: eq(payment.reference, reference),
    });

    if (existingPayment) {
      throw createServiceError("Payment reference already exists", 409);
    }

    const metadata = this.buildMetadata(input, urls.cancelUrl);
    const initializeResponse = await this.paystackClient.initializeTransaction({
      email: authenticatedEmail.trim(),
      amount: input.amountMinor,
      reference,
      currency: (input.currency || "NGN").toUpperCase(),
      callback_url: urls.redirectUrl,
      ...(channels ? { channels } : {}),
      metadata,
    });

    const [newPayment] = await db
      .insert(payment)
      .values({
        userId,
        bookingId: input.bookingId || null,
        provider: "paystack",
        reference,
        amountMinor: input.amountMinor,
        currency: (input.currency || "NGN").toUpperCase(),
        productName: sanitizeInput(input.productName),
        productDescription: sanitizeInput(input.productDescription),
        customerName: this.sanitizeOptional(input.customerName),
        customerEmail: authenticatedEmail.trim(),
        customerMobile: this.sanitizeOptional(input.customerMobile),
        status: "pending",
        providerStatus: "pending",
        checkoutUrl: initializeResponse.data.authorization_url,
        checkoutToken: initializeResponse.data.access_code,
        redirectUrl: urls.redirectUrl,
        cancelUrl: urls.cancelUrl || null,
        channels,
        rawInitializeResponse: initializeResponse.raw,
        metadata,
      })
      .returning();

    return newPayment;
  }

  async getPaymentByReference(userId: string, reference: string) {
    const existingPayment = await db.query.payment.findFirst({
      where: and(eq(payment.reference, reference), eq(payment.userId, userId)),
    });

    if (!existingPayment) {
      throw createServiceError("Payment not found", 404);
    }

    return existingPayment;
  }

  async refreshPaymentStatus(userId: string, reference: string) {
    const existingPayment = await this.getPaymentByReference(userId, reference);
    const verification = await this.paystackClient.verifyTransaction(reference);

    return this.updatePaymentFromVerification(
      existingPayment,
      verification.data,
      verification.raw,
    );
  }

  async processWebhook(input: {
    signature?: string;
    rawBody?: Buffer;
    event: PaystackWebhookPayload;
  }) {
    const signatureValid = this.config.paystackSecretKey
      ? verifyPaystackWebhookSignature({
          rawBody: input.rawBody,
          signature: input.signature,
          secret: this.config.paystackSecretKey,
        })
      : false;

    const [webhookRecord] = await db
      .insert(paymentWebhook)
      .values({
        provider: "paystack",
        paymentReference: input.event.data.reference,
        eventType: input.event.event,
        signatureValid,
        payload: input.event,
        verificationNote: signatureValid
          ? "Webhook signature verified"
          : "Webhook signature invalid or secret not configured",
      })
      .returning();

    const existingPayment = await db.query.payment.findFirst({
      where: eq(payment.reference, input.event.data.reference),
    });

    if (!existingPayment) {
      await db
        .update(paymentWebhook)
        .set({
          processedAt: new Date(),
          verificationNote: "Payment reference not found locally",
        })
        .where(eq(paymentWebhook.id, webhookRecord.id));

      return {
        acknowledged: true,
        processed: false,
      };
    }

    if (!signatureValid) {
      await db
        .update(paymentWebhook)
        .set({
          processedAt: new Date(),
          verificationNote: "Webhook signature verification failed",
        })
        .where(eq(paymentWebhook.id, webhookRecord.id));

      return {
        acknowledged: true,
        processed: false,
      };
    }

    if (input.event.event !== "charge.success") {
      await db
        .update(paymentWebhook)
        .set({
          processedAt: new Date(),
          verificationNote: `Ignored unsupported event ${input.event.event}`,
        })
        .where(eq(paymentWebhook.id, webhookRecord.id));

      return {
        acknowledged: true,
        processed: false,
      };
    }

    const verification = await this.paystackClient.verifyTransaction(
      existingPayment.reference,
    );
    const updatedPayment = await this.updatePaymentFromVerification(
      existingPayment,
      verification.data,
      verification.raw,
    );

    await db
      .update(paymentWebhook)
      .set({
        processedAt: new Date(),
        verificationNote:
          "Webhook verified via signature and Paystack verification API",
      })
      .where(eq(paymentWebhook.id, webhookRecord.id));

    return {
      acknowledged: true,
      processed: true,
      payment: updatedPayment,
    };
  }
}
