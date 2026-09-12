import { getConfig } from "../config/index";
import { PaymentRepository } from "./payment.repository";
import { PaymentInitService } from "./payment-init.service";
import { PaymentPayoutRefundService } from "./payment-payout-refund.service";
import { PaymentWebhookService } from "./payment-webhook.service";

import { KoraClient } from "./kora.client";
import type {
  InitializePaymentInput,
  KoraWebhookPayload,
} from "./payment.types";

export class PaymentService {
  private readonly config = getConfig();
  private readonly repo = new PaymentRepository();
  private readonly kora = new KoraClient();
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

  async resolveReturnUrl() {
    return `${this.config.FRONTEND_URL}/trip-status`;
  }

  async handleKoraWebhook(webhook: KoraWebhookPayload, signature?: string) {
    return this.webhookService.processWebhook(webhook, signature);
  }
}

export const paymentService = new PaymentService();