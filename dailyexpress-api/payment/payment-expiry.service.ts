import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, payment } from "../db/index";
import { logger } from "../utils/logger";
import { PaymentRepository, paymentRepository } from "./payment.repository";
import type { PaymentStatus } from "./payment.types";
import { koraClient } from "./kora.client";
import { paymentPayoutRefundService } from "./payment-payout-refund.service";

export class PaymentExpiryService {
  private readonly kora = koraClient;
  private readonly refundService = paymentPayoutRefundService;

  constructor(private repo: PaymentRepository) {}

  async expirePayment(reference: string) {
    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment || existingPayment.status !== "pending") {
      logger.info("payment.expiry_already_processed", { reference });
      return;
    }

    // Call Kora to check actual transaction status
    let verification;
    try {
      verification = await this.kora.verifyTransaction(reference);
    } catch (error: any) {
      // If reference not found on Kora (HTTP 404), it means the user never even started checkout.
      // In this case, we can proceed to expire it.
      if (error?.koraHttpStatus === 404) {
        // Safe to expire
      } else {
        // Other network errors: throw to let pg-boss retry the job
        throw error;
      }
    }

    const koraStatus = verification?.data?.status?.toLowerCase();

    if (koraStatus === "success" && verification) {
      // User paid successfully! We must mark the payment as expired (since the hold window passed)
      // and trigger an auto-refund.
      const [claimed] = await this.repo.claimPayment(reference);
      if (!claimed) {
        logger.info("payment.expiry_claim_failed_race", { reference });
        return;
      }

      await this.repo.updateProcessingPayment(reference, "expired" as PaymentStatus, {
        failureCode: "BOOKING_EXPIRED",
        failureReason: "Payment completed after booking hold expired",
        providerStatus: "success",
      });

      await this.refundService.refundPayment(
        reference,
        {
          amount: verification.data.amount,
          currency: verification.data.currency,
          paid_at: verification.data.paid_at,
          payment_reference: verification.data.payment_reference,
          reference: verification.data.reference,
          status: verification.data.status,
        },
        "Payment completed after booking hold expired",
      );
      return;
    }

    // If not successful at Kora, proceed to expire the payment normally
    const [claimed] = await this.repo.claimPayment(reference);
    if (!claimed) {
      logger.info("payment.expiry_already_claimed", { reference });
      return;
    }

    const bookingId = claimed.bookingId;

    await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(payment)
        .set({ status: "expired", failureCode: "BOOKING_EXPIRED", failureReason: "Seat reservation expired", updatedAt: new Date() })
        .where(and(eq(payment.reference, reference), eq(payment.status, "processing")))
        .returning({ id: payment.id });

      if (!updated) {
        logger.warn("payment.expiry_race_lost", { reference });
        return;
      }

      if (bookingId) {
        await tx
          .update(booking)
          .set({
            status: "cancelled",
            paymentStatus: "expired" as PaymentStatus,
            updatedAt: new Date(),
          })
          .where(eq(booking.id, bookingId));
      }
    });
  }
}

export const paymentExpiryService = new PaymentExpiryService(paymentRepository);
