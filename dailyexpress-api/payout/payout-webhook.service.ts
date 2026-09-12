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
    if (!signatureValid) return;

    const reference = input.event.data.reference;
    if (!reference) return;

    const payoutRecord = await this.repo.findPayoutByReference(reference);
    if (!payoutRecord) return;

    if (payoutRecord.status === "success" || payoutRecord.status === "failed") {
      return;
    }

    switch (input.event.event) {
      case "transfer.success":
        await this.settlementService.finalizePayout(payoutRecord);
        return;
      case "transfer.failed":
        await this.notificationService.processPayoutFailure(
          payoutRecord,
          this.getWebhookFailureReason(input.event),
        );
        return;
      default:
        return;
    }
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
