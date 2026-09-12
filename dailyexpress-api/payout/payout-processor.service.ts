import { db } from "../db/connection";
import { and, eq, inArray } from "drizzle-orm";
import { driver, earning, payout, type PayoutRecord, type EarningRecord } from "../db/index";
import { getConfig } from "../config/index";
import { generateReference } from "../utils/payment";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import { PayoutSettlementService, payoutSettlementService } from "./payout-settlement.service";
import { PayoutNotificationService, payoutNotificationService } from "./payout-notification.service";
import { koraClient, isKoraRequestError } from "../payment/kora.client";
import { KORA_ERROR_CODES } from "../utils/payout";

type ActivePayoutDriver = typeof driver.$inferSelect & {
  bankVerificationStatus: "active";
  bankCode: string;
  accountNumber: string;
  accountName: string;
  email: string;
};

export class PayoutProcessorService {
  private readonly config = getConfig();
  private readonly kora = koraClient;

  constructor(
    private repo: PayoutRepository,
    private settlementService: PayoutSettlementService,
    private notificationService: PayoutNotificationService,
  ) {}

  async processTripPayout(tripId: string) {
    const latestPayout = await this.repo.findPayoutByTripId(db, tripId);
    if (latestPayout && latestPayout.status !== "failed") return;

    const payoutEarning = await this.repo.findTripPayoutEarningByTripId(
      tripId,
    );
    if (!payoutEarning) return;

    const tripDriver = payoutEarning.driverId;
    if (!tripDriver) return;

    const payoutDriver = await this.getActivePayoutDriver(tripDriver);
    if (!payoutDriver) return;

    if (payoutEarning.amount < this.config.MINIMUM_PAYOUT_AMOUNT) {
      return;
    }

    const payoutRecord = await this.createTripPayout(
      tripId,
      payoutEarning,
      payoutDriver,
    );

    if (!payoutRecord) return;

    await this.executeAttempt(payoutRecord, payoutDriver);
  }

  private async executeAttempt(
    payoutRecord: PayoutRecord,
    payoutDriver: ActivePayoutDriver,
  ) {
    const reference = payoutRecord.reference;

    // Prevents duplicate payout attempts: lock serializes creation and marks
    // the payout as "processing" before the external API call so concurrent
    // workers see the updated status and exit early.
    const locked = await db.transaction(async (tx) => {
      const [lockedPayout] = await tx
        .select()
        .from(payout)
        .where(eq(payout.id, payoutRecord.id))
        .for("update")
        .limit(1);
      if (!lockedPayout) throw new Error("Payout not found");

      if (
        lockedPayout.status === "success" ||
        lockedPayout.status === "failed" ||
        lockedPayout.status === "processing"
      ) {
        return { alreadyFinalized: true };
      }

      await tx
        .update(payout)
        .set({
          status: "processing",
          failureCode: null,
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(eq(payout.id, payoutRecord.id));

      if (payoutRecord.tripId) {
        await tx
          .update(earning)
          .set({
            status: "processing",
            payoutId: payoutRecord.id,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(earning.tripId, payoutRecord.tripId),
              inArray(earning.status, ["available", "processing"]),
            ),
          );
      }

      return { alreadyFinalized: false };
    });

    if (locked.alreadyFinalized) return;

    try {
      await this.kora.initiatePayout({
        reference,
        amount: payoutRecord.amount,
        currency: payoutRecord.currency,
        bankCode: payoutDriver.bankCode,
        accountNumber: payoutDriver.accountNumber,
        accountName:
          payoutDriver.accountName ||
          `${payoutDriver.firstName} ${payoutDriver.lastName}`,
        customerEmail: payoutDriver.email,
        // narration: `Driver payout ${reference}`,
      });

      await db
        .update(payout)
        .set({
          updatedAt: new Date(),
        })
        .where(eq(payout.id, payoutRecord.id));
    } catch (error: unknown) {
      const koraError = isKoraRequestError(error) ? error : null;
      const errorCode = koraError?.koraErrorCode;

      if (errorCode === "conflict") {
        await this.notificationService.processPayoutFailure(
          payoutRecord,
          KORA_ERROR_CODES.INSUFFICIENT_BALANCE,
        );
        return;
      }

      // Any other error (network/5xx/unknown) means the transfer may have been
      // created. Ask the provider before declaring a failure to avoid
      // double-paying the driver on retry.
      const outcome = await this.settlementService.verifyWithProvider(
        payoutRecord,
      );
      if (outcome === "settled") return;
      if (outcome === "failed") {
        await this.notificationService.processPayoutFailure(
          payoutRecord,
          errorCode || "PAYOUT_FAILED",
        );
        return;
      }
      // "processing" / "unknown": leave payout processing and let the
      // provider webhook confirm the final state.
      return;
    }
  }

  private async createTripPayout(
    tripId: string,
    payoutEarning: EarningRecord,
    payoutDriver: ActivePayoutDriver,
  ): Promise<PayoutRecord | null> {
    return db.transaction(async (tx) => {
      const [createdPayout] = await this.repo.insertPayout(tx, {
        driverId: payoutEarning.driverId!,
        driverEmail: payoutDriver.email,
        recipientBankName: payoutDriver.bankName,
        recipientAccountLast4: payoutDriver.accountNumber.slice(-4),
        tripId,
        reference: this.buildPayoutReference(),
        amount: payoutEarning.amount,
        currency: payoutEarning.currency || "NGN",
        status: "pending",
      });

      if (!createdPayout) {
        return null;
      }

      await tx
        .update(earning)
        .set({ payoutId: createdPayout.id, updatedAt: new Date() })
        .where(eq(earning.tripId, tripId));

      return createdPayout;
    });
  }

  private async getActivePayoutDriver(
    driverId: string,
  ): Promise<ActivePayoutDriver | null> {
    const record = await this.repo.findDriverById(driverId);

    if (
      !record ||
      !record.isActive ||
      record.bankVerificationStatus !== "active" ||
      !record.bankCode ||
      !record.accountNumber ||
      !record.accountName ||
      !record.email
    ) {
      return null;
    }

    return record as ActivePayoutDriver;
  }

  private buildPayoutReference() {
    return generateReference();
  }
}

export const payoutProcessorService = new PayoutProcessorService(
  payoutRepository,
  payoutSettlementService,
  payoutNotificationService,
);
