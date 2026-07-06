import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { driver, notification } from "../db/index";
import { notificationService } from "../notification/notification.service";
import { publishNotificationCreated } from "../notification/realtime";
import { koraClient } from "../payment/kora.client";
import { koraIdentityClient } from "../kyc/kora-identity.client";
import { kycDedupClient } from "../kyc/kyc-dedup.client";
import { getBoss, QUEUES, type DriverVerificationJobData } from "./boss";
import { jobService } from "./job.service";
import { logger } from "../utils/logger";

function driverExists(driverId: string) {
  return db.query.driver.findFirst({
    where: eq(driver.id, driverId),
    columns: { id: true },
  });
}

// --- Bank Verification ---

function bankDetailsMatch(
  record: typeof driver.$inferSelect,
  data: { bankName: string; bankCode: string; accountNumber: string; accountName: string; currency: string },
) {
  return (
    record.bankName === data.bankName &&
    record.bankCode === data.bankCode &&
    record.accountNumber === data.accountNumber &&
    record.accountName === data.accountName &&
    record.currency === data.currency
  );
}

function bankVerifiedNotification() {
  return {
    notificationKey: "bank:verification:verified",
    kind: "state" as const,
    type: "bank_verification_verified",
      title: "Payout account verified",
    message: "Your bank account is verified and ready for payouts.",
    href: "/settings/bank-details",
    tag: "Verified",
    tone: "positive" as const,
    occurredAt: new Date(),
  };
}

function bankFailedNotification(reason: string) {
  return {
    notificationKey: "bank:verification:failed",
    kind: "state" as const,
    type: "bank_verification_failed",
    title: "Bank details need attention",
    message: reason || "Your payout account could not be verified. Update your bank details to resume payouts.",
    href: "/settings/bank-details",
    tag: "Payout issue",
    tone: "critical" as const,
    metadata: { reason },
    occurredAt: new Date(),
  };
}

async function processBankVerification(
  data: DriverVerificationJobData & { type: "bank_verification" },
) {
  const current = await db.query.driver.findFirst({
    where: eq(driver.id, data.driverId),
  });

  if (!current || !bankDetailsMatch(current, data)) {
    logger.info("worker.verification.bank_skipped_stale", {
      driverId: data.driverId,
    });
    return;
  }

  try {
    const resolved = await koraClient.resolveAccountNumber(
      current.bankCode,
      current.accountNumber,
      current.currency,
    );

    const result = await db.transaction(async (tx) => {
      const current = await tx.query.driver.findFirst({
        where: eq(driver.id, data.driverId),
      });

      if (!current || !bankDetailsMatch(current, data)) {
        return { notificationResult: null, earningId: null as string | null };
      }

      await tx
        .update(driver)
        .set({
          bankName: resolved.data.bank_name || data.bankName,
          bankCode: resolved.data.bank_code || data.bankCode,
          accountNumber: resolved.data.account_number || data.accountNumber,
          accountName: resolved.data.account_name || data.accountName,
          bankVerificationStatus: "active",
          bankVerificationFailureReason: null,
          bankVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(driver.id, data.driverId));

      const notificationResult = await notificationService.createBankVerificationStateInTransaction(
        tx,
        data.driverId,
        bankVerifiedNotification(),
      );

      const pendingNotification = await tx.query.notification.findFirst({
        where: and(
          eq(notification.driverId, data.driverId),
          eq(notification.notificationKey, "account-setup-pending"),
        ),
        columns: { metadata: true },
      });

      const earningId = pendingNotification?.metadata &&
        typeof pendingNotification.metadata === "object" &&
        "earningId" in pendingNotification.metadata
        ? (pendingNotification.metadata as Record<string, unknown>).earningId as string
        : null;

      if (earningId) {
        await jobService.enqueuePayout(tx, { earningId });
      }

      return { notificationResult, earningId };
    });

    if (result.notificationResult?.notification && result.notificationResult.shouldDeliver) {
      await publishNotificationCreated(result.notificationResult.notification);
    }

    if (result.earningId) {
      logger.info("worker.verification.bank_payout_reenqueued", {
        driverId: data.driverId,
        earningId: result.earningId,
      });
    }

    logger.info("worker.verification.bank_completed", {
      driverId: data.driverId,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Bank verification failed";
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
        bankFailedNotification(reason),
      );
    });

    if (notification?.notification && notification.shouldDeliver) {
      await publishNotificationCreated(notification.notification);
    }

    logger.warn("worker.verification.bank_failed", {
      driverId: data.driverId,
      reason,
    });
  }
}

// --- KYC Verification ---

function kycVerifiedNotification() {
  return {
    notificationKey: "kyc:verification:verified",
    kind: "state" as const,
    type: "kyc_verification_verified",
    title: "Identity verified",
    message: "Your identity has been verified successfully. You can now claim trips.",
    href: "/settings/bank-details",
    tag: "Verified",
    tone: "positive" as const,
  };
}

function kycFailedNotification(reason: string) {
  return {
    notificationKey: "kyc:verification:failed",
    kind: "state" as const,
    type: "kyc_verification_failed",
    title: "Identity verification failed",
    message: reason || "Your identity could not be verified. Please resubmit your details.",
    href: "/settings/bank-details",
    tag: "KYC issue",
    tone: "critical" as const,
    metadata: { reason },
    occurredAt: new Date(),
  };
}

async function processKycVerification(
  data: DriverVerificationJobData & { type: "kyc_verification" },
) {
  const exists = await driverExists(data.driverId);
  if (!exists) {
    logger.info("worker.verification.kyc_skipped_stale", {
      driverId: data.driverId,
    });
    return;
  }

  try {
    let verified: { reference: string };
    const validation = data.firstName || data.lastName || data.dateOfBirth
      ? { firstName: data.firstName, lastName: data.lastName, dateOfBirth: data.dateOfBirth }
      : undefined;

    if (data.kycType === "bvn") {
      verified = await koraIdentityClient.verifyBVN(data.kycId, validation);
    } else {
      verified = await koraIdentityClient.verifyNIN(data.kycId, validation);
    }

    await kycDedupClient.markVerified(data.kycId, data.driverId, data.kycType);

    const kycNotification = await db.transaction(async (tx) => {
      const current = await tx.query.driver.findFirst({
        where: eq(driver.id, data.driverId),
        columns: { id: true, kycStatus: true },
      });

      if (!current || current.kycStatus !== "pending") {
        return null;
      }

      await tx
        .update(driver)
        .set({
          kycStatus: "active",
          kycVerificationReference: verified.reference,
          kycFailureReason: null,
          kycVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(driver.id, data.driverId));

      return notificationService.createKycVerificationStateInTransaction(
        tx,
        data.driverId,
        kycVerifiedNotification(),
      );
    });

    if (kycNotification?.notification && kycNotification.shouldDeliver) {
      await publishNotificationCreated(kycNotification.notification);
    }

    logger.info("worker.verification.kyc_completed", {
      driverId: data.driverId,
      kycType: data.kycType,
      reference: verified.reference,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "KYC verification failed";

    try {
      await kycDedupClient.releaseClaim(data.kycId);
    } catch {
      // Redis might be down — rely on TTL to eventually clean up
    }

    const kycNotification = await db.transaction(async (tx) => {
      const current = await tx.query.driver.findFirst({
        where: eq(driver.id, data.driverId),
        columns: { id: true, kycStatus: true },
      });

      if (!current || current.kycStatus !== "pending") {
        return null;
      }

      await tx
        .update(driver)
        .set({
          kycStatus: "failed",
          kycFailureReason: reason,
          kycVerifiedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(driver.id, data.driverId));

      return notificationService.createKycVerificationStateInTransaction(
        tx,
        data.driverId,
        kycFailedNotification(reason),
      );
    });

    if (kycNotification?.notification && kycNotification.shouldDeliver) {
      await publishNotificationCreated(kycNotification.notification);
    }

    logger.warn("worker.verification.kyc_failed", {
      driverId: data.driverId,
      kycType: data.kycType,
      reason,
    });
  }
}

// --- Worker Registration ---

export async function registerDriverVerificationWorker() {
  const boss = await getBoss();

  await boss.work<DriverVerificationJobData>(
    QUEUES.DRIVER_VERIFICATION,
    {
      batchSize: 1,
      localConcurrency: 2,
      pollingIntervalSeconds: 2,
      heartbeatRefreshSeconds: 30,
    },
    async ([job]) => {
      const { type, driverId } = job.data;

      logger.info("worker.verification.started", {
        jobId: job.id,
        type,
        driverId,
      });

      if (type === "bank_verification") {
        await processBankVerification(job.data);
      } else if (type === "kyc_verification") {
        await processKycVerification(job.data);
      }
    },
  );
}
