import { PayoutRepository, payoutRepository } from "./payout.repository";
import { PayoutSettlementService, payoutSettlementService } from "./payout-settlement.service";
import { PayoutNotificationService, payoutNotificationService } from "./payout-notification.service";
import { koraClient } from "../payment/kora.client";
import { KORA_ERROR_CODES } from "../utils/payout";
import type { KoraPayoutWebhookPayload } from "../payment/payment.types";

export class PayoutWebhookService {
  private readonly kora = koraClient;

  constructor(
    private repo: PayoutRepository,
    private settlementService: PayoutSettlementService,
    private notificationService: PayoutNotificationService,
  ) {}

  async processWebhook(input: {
    signature?: string;
    event: KoraPayoutWebhookPayload;
  }) {
    const signatureValid = this.kora.verifyWebhookSignature(
      input.event.data,
      input.signature,
    );
    if (!signatureValid) return { processed: false, signatureValid };

    const reference = input.event.data.reference;
    if (!reference) return { processed: false, signatureValid };

    const payoutRecord = await this.repo.findPayoutByReference(reference);
    if (!payoutRecord) return { processed: false, signatureValid };

    if (payoutRecord.status === "success" || payoutRecord.status === "failed") {
      return { processed: true, signatureValid };
    }

    if (input.event.event === "transfer.success") {
      await this.settlementService.finalizePayout(payoutRecord, input.event);
      return { processed: true, signatureValid };
    }

    if (input.event.event === "transfer.failed") {
      await this.notificationService.processPayoutFailure(
        payoutRecord,
        this.getWebhookFailureReason(input.event),
        input.event,
        true,
      );
      return { processed: true, signatureValid };
    }

    return { processed: false, signatureValid };
  }

  private getWebhookFailureReason(event: KoraPayoutWebhookPayload): string {
    const message = (event.data.message || "").trim();
    if (message.toLowerCase().includes("insufficient")) {
      return KORA_ERROR_CODES.INSUFFICIENT_BALANCE;
    }
    return message || "Transfer failed";
  }
}

export const payoutWebhookService = new PayoutWebhookService(
  payoutRepository,
  payoutSettlementService,
  payoutNotificationService,
);
