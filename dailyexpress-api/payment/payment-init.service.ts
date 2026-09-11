import { createServiceError, sanitizeInput } from "@shared/utils";
import { eq } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { booking, payment } from "../db/index";
import { logger } from "../utils/logger";
import { calculateTripChargeAmount, dedupeChannels, generateReference } from "../utils/payment";
import { koraClient } from "./kora.client";
import { PaymentRepository } from "./payment.repository";
import type {
    InitializePaymentInput,
    KoraChannel,
    KoraInitializeResponse,
} from "./payment.types";



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

    // 1. If a payment already exists for this booking (any status), return it (conflict handling)
    const existingPayment = await this.repo.findPaymentByBookingId(input.bookingId);
    if (existingPayment) {
      logger.info("payment.initialize_existing_returned", {
        bookingId: input.bookingId,
        status: existingPayment.status,
      });
      return existingPayment;
    }

    const reference = this.buildReference(input.reference);
    const channels = dedupeChannels(input.channels);
    const productName = sanitizeInput(input.productName);
    const bookingFare = await this.repo.findBookingFareByBookingId(
      input.bookingId,
      userId,
    );
    const trustedCurrency = bookingFare.currency;
    const trustedAmount = calculateTripChargeAmount(bookingFare);

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

      const currentPayment = await tx.query.payment.findFirst({
        where: eq(payment.bookingId, input.bookingId),
      });

      if (currentPayment) {
        return { action: "return_existing" as const, payment: currentPayment };
      }

      const [inserted] = await tx
        .insert(payment)
        .values({
          userId,
          bookingId: input.bookingId,
          reference,
          amount: trustedAmount,
          currency: trustedCurrency,
          productName,
          customerEmail: authenticatedEmail.trim(),
          status: "initialized",
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

    if (setupResult.action === "return_existing") {
      return setupResult.payment;
    }

    // 3. call Kora checkout API outside the transaction
    let initializeResponse: { data: KoraInitializeResponse; raw: unknown };
    try {
      initializeResponse = await this.createKoraCheckoutSession({
        email: authenticatedEmail.trim(),
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
          updatedAt: new Date(),
        })
        .where(eq(payment.id, setupResult.payment.id))
        .returning();

      if (updated) {
        return updated || setupResult.payment;
      }
    });

    logger.info("payment.initialized", {
      bookingId: input.bookingId,
      reference,
    });

    return finalPayment;
  }

  private async createKoraCheckoutSession(params: {
    email: string;
    amount: number;
    reference: string;
    currency: string;
    channels?: KoraChannel[] | null;
  }) {
    return this.kora.initializeTransaction({
      customer: {
        email: params.email,
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

  private getPaymentPublicBaseUrl() {
    const configured =
      this.config.PAYMENT_PUBLIC_BASE_URL || this.config.KORA_WEBHOOK_URL;
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
