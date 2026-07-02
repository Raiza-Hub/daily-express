import { createHash } from "node:crypto";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import type { driver } from "../db/index";

type ActivePayoutDriver = typeof driver.$inferSelect & {
  bankVerificationStatus: "active";
};

export class PayoutRecipientService {
  constructor(private repo: PayoutRepository) {}

  async getRecipient(payoutDriver: ActivePayoutDriver) {
    const fingerprint = this.computeBankDetailsHash(payoutDriver);
    const existingRecipient = await this.repo.findRecipientByDriverId(
      payoutDriver.id,
    );

    if (
      existingRecipient &&
      existingRecipient.detailsFingerprint === fingerprint &&
      existingRecipient.status === "active"
    ) {
      return existingRecipient;
    }

    const payload = {
      driverId: payoutDriver.id,
      provider: "kora" as const,
      recipientCode: payoutDriver.accountNumber,
      providerRecipientId: payoutDriver.bankCode,
      bankCode: payoutDriver.bankCode,
      bankName: payoutDriver.bankName,
      accountName: payoutDriver.accountName,
      accountNumberLast4: payoutDriver.accountNumber.slice(-4),
      detailsFingerprint: fingerprint,
      status: "active" as const,
      rawResponse: {
        source: "driver.bank_verification",
        bankName: payoutDriver.bankName,
        bankCode: payoutDriver.bankCode,
        accountName: payoutDriver.accountName,
      },
      updatedAt: new Date(),
    };

    return this.repo.upsertRecipient(payoutDriver.id, payload);
  }

  computeBankDetailsHash(record: ActivePayoutDriver) {
    return createHash("sha256")
      .update(
        [
          record.bankCode,
          record.bankName,
          record.accountNumber,
          record.accountName,
          record.currency,
        ].join("|"),
      )
      .digest("hex");
  }
}

export const payoutRecipientService = new PayoutRecipientService(payoutRepository);
