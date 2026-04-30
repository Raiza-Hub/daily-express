import { and, eq, inArray } from "drizzle-orm";
import { logger } from "@shared/logger";
import { db } from "../db/db";
import { outboxEvents, payment } from "../db/schema";
import { getBoss, QUEUES, type WebhookJobData } from "./boss";
import { koraClient } from "./kora.client";
import { paymentService } from "./paymentService";

const MAX_PROJECTION_RETRIES = 3;

function getPaymentReference(job: WebhookJobData) {
  if (job.event.startsWith("refund.")) {
    return (
      (job.data.payment_reference as string | undefined) ||
      (job.data.reference as string | undefined) ||
      null
    );
  }

  return (
    (job.data.reference as string | undefined) ||
    (job.data.payment_reference as string | undefined) ||
    null
  );
}

export async function processWebhookJob(job: WebhookJobData): Promise<void> {
  const reference = getPaymentReference(job);

  if (!reference) {
    logger.warn("payment.webhook_missing_reference", {
      event: job.event,
    });
    return;
  }

  if (job.event === "charge.success" || job.event === "charge.failed") {
    const alreadyProcessed = await db.query.outboxEvents.findFirst({
      where: and(
        eq(outboxEvents.aggregateId, reference),
        inArray(outboxEvents.eventType, ["payment.completed", "payment.failed"]),
      ),
    });

    if (alreadyProcessed) {
      logger.info("payment.webhook_duplicate_terminal", {
        event: job.event,
        reference,
      });
      return;
    }
  }

  switch (job.event) {
    case "charge.success":
      await handleChargeSuccess(job, reference);
      return;
    case "charge.failed":
      await handleChargeFailed(reference);
      return;
    case "refund.success":
      await handleRefundSuccess(reference);
      return;
    case "refund.failed":
      await handleRefundFailed(reference);
      return;
    default:
      logger.info("payment.webhook_ignored", {
        event: job.event,
        reference,
      });
  }
}

async function handleChargeSuccess(
  job: WebhookJobData,
  reference: string,
): Promise<void> {
  const verification = await koraClient.verifyTransaction(reference);
  logger.info("payment.kora_verification_response", {
    source: "webhook_charge_success",
    requestedReference: reference,
    providerReference: verification.data.reference || null,
    providerPaymentReference: verification.data.payment_reference || null,
    providerStatus: verification.data.status,
    amount: verification.data.amount,
    currency: verification.data.currency,
    paidAt: verification.data.paid_at || null,
  });

  if (verification.data.status.toLowerCase() !== "success") {
    logger.warn("payment.webhook_success_verification_mismatch", {
      koraStatus: verification.data.status,
      reference,
    });
    return;
  }

  const paymentRecord = await paymentService.getPaymentRecord(reference);
  if (!paymentRecord) {
    logger.warn("payment.webhook_success_missing_payment", {
      reference,
    });
    return;
  }

  const hold = paymentRecord.bookingId
    ? await paymentService.getBookingHoldRecord(paymentRecord.bookingId)
    : null;

  if (!hold) {
    const retryCount = job._retryCount ?? 0;

    if (retryCount < MAX_PROJECTION_RETRIES) {
      const boss = await getBoss();
      await boss.send(
        QUEUES.PROCESS_WEBHOOK,
        {
          ...job,
          _retryCount: retryCount + 1,
        },
        {
          startAfter: 15,
        },
      );

      logger.warn("payment.webhook_hold_not_ready", {
        reference,
        retryCount: retryCount + 1,
      });
      return;
    }

    await paymentService.initiateAutoRefund(
      reference,
      verification.data,
      verification.raw,
    );
    return;
  }

  if (hold.expiresAt.getTime() <= Date.now()) {
    await paymentService.initiateAutoRefund(
      reference,
      verification.data,
      verification.raw,
    );
    return;
  }

  await paymentService.confirmPendingPaymentSuccess(
    reference,
    verification.data,
    verification.raw,
  );
}

async function handleChargeFailed(reference: string): Promise<void> {
  const verification = await koraClient.verifyTransaction(reference);
  logger.info("payment.kora_verification_response", {
    source: "webhook_charge_failed",
    requestedReference: reference,
    providerReference: verification.data.reference || null,
    providerPaymentReference: verification.data.payment_reference || null,
    providerStatus: verification.data.status,
    amount: verification.data.amount,
    currency: verification.data.currency,
    paidAt: verification.data.paid_at || null,
  });

  if (verification.data.status.toLowerCase() === "success") {
    await handleChargeSuccess(
      {
        event: "charge.success",
        data: {
          ...verification.data,
          reference,
        },
        _retryCount: 0,
      },
      reference,
    );
    return;
  }

  await paymentService.failPendingPayment(
    reference,
    "failed",
    verification.data.message || "Payment provider reported a failed charge",
    {
      failureCode: "PAYMENT_FAILED",
      providerStatus: verification.data.status,
      rawVerificationResponse: verification.raw,
    },
  );
}

async function handleRefundSuccess(reference: string): Promise<void> {
  await db
    .update(payment)
    .set({
      status: "refunded",
      updatedAt: new Date(),
    })
    .where(eq(payment.reference, reference));

  logger.info("payment.refund_succeeded", {
    reference,
  });
}

async function handleRefundFailed(reference: string): Promise<void> {
  await db
    .update(payment)
    .set({
      status: "refund_failed",
      updatedAt: new Date(),
    })
    .where(eq(payment.reference, reference));

  logger.error("payment.refund_failed", {
    reference,
  });
}
