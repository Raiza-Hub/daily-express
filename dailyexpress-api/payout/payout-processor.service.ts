import { db } from "../db/connection";
import { and, eq, inArray } from "drizzle-orm";
import { driver, earning, payout, type PayoutRecord, type EarningRecord } from "../db/index";
import { getConfig } from "../config/index";
import { generateReference } from "../utils/payment";
import { PayoutRepository, payoutRepository } from "./payout.repository";
import { PayoutSettlementService, payoutSettlementService } from "./payout-settlement.service";
import { PayoutNotificationService, payoutNotificationService } from "./payout-notification.service";
import { notificationService as sharedNotificationService } from "../notification/notification.service";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { koraClient, isKoraRequestError, type KoraRequestError } from "../payment/kora.client";
import { KORA_ERROR_CODES } from "../utils/payout";

type ActivePayoutDriver = typeof driver.$inferSelect & {
  bankVerificationStatus: "active";
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
    const earnings = await this.repo.findTripPayoutEarnings(tripId);
    if (earnings.length === 0) return;

    const payoutDriver = await this.getActivePayoutDriver(
      earnings[0].driverId,
    );
    if (!payoutDriver) {
      await db.transaction(async (tx) => {
        const notification = await sharedNotificationService.createForDriverInTransaction(
          tx,
          earnings[0].driverId,
          {
            notificationKey: "account-setup-pending",
            kind: "state",
            type: "bank_setup_pending",
            title: "Bank account setup needed",
            message:
              "Your bank account information is incomplete. Please update your bank details in your profile to receive payouts.",
            href: "/settings/bank-details",
            tag: "Action needed",
            tone: "attention",
            metadata: {
              tripId,
            },
            occurredAt: new Date(),
          },
        );
        if (notification) {
          publishNotificationCreatedInBackground(notification);
        }
      });
      return;
    }

    const latestPayout = await this.repo.findPayoutByTripId(db, tripId);
    if (latestPayout && latestPayout.status !== "failed") {
      return;
    }

    const payoutRecord = await this.createTripPayout(
      tripId,
      earnings,
      payoutDriver,
    );

    if (payoutRecord.amount < this.config.MINIMUM_PAYOUT_AMOUNT) {
      await db.transaction(async (tx) => {
        const notification =
          await sharedNotificationService.createForDriverInTransaction(
            tx,
            earnings[0].driverId,
            {
              notificationKey: "payout-too-small",
              kind: "state",
              type: "payout_too_small",
              title: "Minimum payout not met",
              message:
                "Your earnings are below the ₦1,000 minimum payout threshold. Funds will be held until you reach the minimum.",
              href: "/",
              tag: "Info",
              tone: "info",
              metadata: {
                tripId,
                amount: payoutRecord.amount,
              },
              occurredAt: new Date(),
            },
          );
        if (notification) {
          publishNotificationCreatedInBackground(notification);
        }
      });
      return;
    }

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
      const result = await this.kora.initiatePayout({
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
          initiatedAt: new Date(),
          rawInitiateResponse: result.raw,
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
          error,
          true,
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
          error,
          true,
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
    earnings: EarningRecord[],
    payoutDriver: ActivePayoutDriver,
  ): Promise<PayoutRecord> {
    const amount = earnings.reduce(
      (sum, entry) => sum + entry.netAmount,
      0,
    );

    return db.transaction(async (tx) => {
      const [createdPayout] = await this.repo.insertPayout(tx, {
        driverId: earnings[0].driverId,
        driverEmail: payoutDriver.email,
        recipientBankName: payoutDriver.bankName,
        recipientAccountLast4: payoutDriver.accountNumber.slice(-4),
        tripId,
        reference: this.buildPayoutReference(),
        amount,
        currency: earnings[0].currency || "NGN",
        status: "pending",
      });

      if (!createdPayout) {
        throw new Error(`Failed to create payout for trip ${tripId}`);
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
