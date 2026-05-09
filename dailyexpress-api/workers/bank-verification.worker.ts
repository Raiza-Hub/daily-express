import { eq } from "drizzle-orm";
import { db } from "../db/connection";
import { driver } from "../db/index";
import { NotificationService } from "../notification/notificationService";
import { publishNotificationCreated } from "../notification/realtime";
import { KoraClient } from "../payment/kora.client";
import { getBoss, QUEUES, type DriverBankVerificationJobData } from "./boss";
import { logger } from "../utils/logger";

const koraClient = new KoraClient();
const notificationService = new NotificationService();

function bankDetailsMatch(
  record: typeof driver.$inferSelect,
  data: DriverBankVerificationJobData,
) {
  return (
    record.bankName === data.bankName &&
    record.bankCode === data.bankCode &&
    record.accountNumber === data.accountNumber &&
    record.accountName === data.accountName &&
    record.currency === data.currency
  );
}

function verifiedNotification() {
  return {
    notificationKey: "bank-verification-verified",
    kind: "state" as const,
    type: "bank_verification_verified",
    title: "Payout account verified",
    message: "Your bank account is verified and ready for automatic payouts.",
    href: "/settings/bank-details",
    tag: "Verified",
    tone: "positive" as const,
    occurredAt: new Date(),
  };
}

function failedNotification(reason: string) {
  return {
    notificationKey: "bank-verification-failed",
    kind: "state" as const,
    type: "bank_verification_failed",
    title: "Bank details need attention",
    message:
      reason ||
      "Your payout account could not be verified. Update your bank details to resume payouts.",
    href: "/settings/bank-details",
    tag: "Payout issue",
    tone: "critical" as const,
    metadata: { reason },
    occurredAt: new Date(),
  };
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Bank verification failed";
}

async function getCurrentDriver(data: DriverBankVerificationJobData) {
  const record = await db.query.driver.findFirst({
    where: eq(driver.id, data.driverId),
  });

  if (!record || !bankDetailsMatch(record, data)) {
    return null;
  }

  return record;
}

async function markBankVerificationSucceeded(
  data: DriverBankVerificationJobData,
  resolved: {
    bank_name: string;
    bank_code: string;
    account_number: string;
    account_name: string;
  },
) {
  const notification = await db.transaction(async (tx) => {
    const current = await tx.query.driver.findFirst({
      where: eq(driver.id, data.driverId),
    });

    if (!current || !bankDetailsMatch(current, data)) {
      return null;
    }

    await tx
      .update(driver)
      .set({
        bankName: resolved.bank_name || data.bankName,
        bankCode: resolved.bank_code || data.bankCode,
        accountNumber: resolved.account_number || data.accountNumber,
        accountName: resolved.account_name || data.accountName,
        bankVerificationStatus: "active",
        bankVerificationFailureReason: null,
        bankVerifiedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(driver.id, data.driverId));

    return notificationService.createBankVerificationStateInTransaction(
      tx,
      data.driverId,
      verifiedNotification(),
    );
  });

  if (notification?.notification && notification.shouldDeliver) {
    await publishNotificationCreated(notification.notification);
  }
}

async function markBankVerificationFailed(
  data: DriverBankVerificationJobData,
  reason: string,
) {
  const notification = await db.transaction(async (tx) => {
    const current = await tx.query.driver.findFirst({
      where: eq(driver.id, data.driverId),
    });

    if (!current || !bankDetailsMatch(current, data)) {
      return null;
    }

    await tx
      .update(driver)
      .set({
        bankVerificationStatus: "failed",
        bankVerificationFailureReason: reason,
        bankVerifiedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(driver.id, data.driverId));

    return notificationService.createBankVerificationStateInTransaction(
      tx,
      data.driverId,
      failedNotification(reason),
    );
  });

  if (notification?.notification && notification.shouldDeliver) {
    await publishNotificationCreated(notification.notification);
  }
}

export async function registerBankVerificationWorker() {
  const boss = await getBoss();

  await boss.work<DriverBankVerificationJobData>(
    QUEUES.DRIVER_BANK_VERIFICATION,
    async ([job]) => {
      logger.info("worker.bank_verification.started", {
        jobId: job.id,
        driverId: job.data.driverId,
      });

      const current = await getCurrentDriver(job.data);
      if (!current) {
        logger.info("worker.bank_verification.skipped_stale", {
          jobId: job.id,
          driverId: job.data.driverId,
        });
        return;
      }

      try {
        const resolved = await koraClient.resolveAccountNumber(
          current.bankCode,
          current.accountNumber,
          current.currency,
        );

        await markBankVerificationSucceeded(job.data, resolved.data);

        logger.info("worker.bank_verification.completed", {
          jobId: job.id,
          driverId: job.data.driverId,
        });
      } catch (error) {
        const reason = getErrorMessage(error);
        await markBankVerificationFailed(job.data, reason);

        logger.warn("worker.bank_verification.failed", {
          jobId: job.id,
          driverId: job.data.driverId,
          reason,
        });
      }
    },
  );
}
