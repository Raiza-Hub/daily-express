import { createServiceError, sanitizeInput } from "@shared/utils";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import { calculateTripChargeAmount, dedupeChannels, generateReference } from "../utils/payment";
import { koraClient } from "./kora.client";
import { PaymentRepository } from "./payment.repository";
import type { PaymentRecord } from "../db/index";
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
    const existing = await this.repo.findPaymentByBookingId(input.bookingId);
    if (existing) {
      logger.info("payment.initialize_existing_returned", {
        bookingId: input.bookingId,
        status: existing.status,
      });
      if (existing.checkoutUrl) return existing;
      return this.finishPendingCheckout(existing);
    }

    const bookingFare = await this.repo.findBookingFareByBookingId(
      input.bookingId,
      userId,
    );
    const reference = this.buildReference(input.reference);

    const [created] = await this.repo.insertPayment({
      userId,
      bookingId: input.bookingId,
      reference,
      amount: calculateTripChargeAmount(bookingFare),
      currency: bookingFare.currency,
      productName: sanitizeInput(input.productName),
      customerEmail: authenticatedEmail.trim(),
      status: "initialized",
    });

    if (!created) {
      const winner = await this.repo.findPaymentByBookingId(input.bookingId);
      if (!winner) {
        throw new Error(
          "Payment conflict occurred but existing record not found",
        );
      }
      return winner;
    }

    try {
      const finalized = await this.finishPendingCheckout(created, input.channels);
      logger.info("payment.initialized", {
        bookingId: input.bookingId,
        reference,
      });
      return finalized;
    } catch (koraError) {
      await this.repo.deletePayment(created.id);
      throw koraError;
    }
  }

  private async finishPendingCheckout(
    paymentRecord: PaymentRecord,
    channels?: KoraChannel[] | null,
  ) {
    const { data } = await this.createKoraCheckoutSession({
      email: paymentRecord.customerEmail || "",
      amount: paymentRecord.amount,
      reference: paymentRecord.reference,
      currency: paymentRecord.currency,
      channels,
    });

    const [updated] = await this.repo.setPendingCheckout(
      paymentRecord.id,
      data.checkout_url,
    );
    return updated ?? paymentRecord;
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