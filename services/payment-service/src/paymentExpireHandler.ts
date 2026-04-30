import { logger } from "@shared/logger";
import { koraClient } from "./kora.client";
import type { PaymentExpireJobData } from "./boss";
import { paymentService } from "./paymentService";

export async function handlePaymentExpiry(
  payload: PaymentExpireJobData,
): Promise<void> {
  const existingPayment = await paymentService.getPaymentRecord(payload.reference);

  if (!existingPayment) {
    logger.warn("payment.expire_missing_payment", {
      bookingId: payload.bookingId,
      reference: payload.reference,
    });
    return;
  }

  if (existingPayment.status !== "pending") {
    logger.info("payment.expire_skipped_terminal", {
      bookingId: payload.bookingId,
      reference: payload.reference,
      status: existingPayment.status,
    });
    return;
  }

  const verification = await koraClient.verifyTransaction(payload.reference);

  if (verification.data.status.toLowerCase() === "success") {
    const hold = await paymentService.getBookingHoldRecord(
      payload.bookingId,
    );

    if (!hold || hold.expiresAt.getTime() <= Date.now()) {
      await paymentService.initiateAutoRefund(
        payload.reference,
        verification.data,
        verification.raw,
      );
      return;
    }

    await paymentService.confirmPendingPaymentSuccess(
      payload.reference,
      verification.data,
      verification.raw,
    );
    return;
  }

  await paymentService.failPendingPayment(
    payload.reference,
    "expired",
    "Seat reservation expired before payment was completed",
    {
      failureCode: "PAYMENT_EXPIRED",
      providerStatus: verification.data.status,
      rawVerificationResponse: verification.raw,
    },
  );
}
