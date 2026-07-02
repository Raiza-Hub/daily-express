import { getEmailSubject, renderEmail } from "@repo/email";
import { and, eq, gt, sql } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { booking, earning, payment, refund, trip } from "../db/index";
import { driverService as sharedDriverService } from "../driver/driver.service";
import { logger } from "../utils/logger";
import { generateReference, toMinorAmount } from "../utils/payment";
import { jobService } from "../workers/job.service";
import { koraClient } from "./kora.client";
import { PaymentRepository, paymentRepository } from "./payment.repository";
import type { PaymentRecord, BookingRecord, RefundRecord } from "../db/index";
import { enrichWithExpiry } from "./payment.utils";
import type { KoraVerifyResponse, PaymentTransaction } from "./payment.types";

export class PaymentRefundService {
  private readonly config = getConfig();
  private readonly kora = koraClient;
  private readonly driverService = sharedDriverService;

  constructor(private repo = paymentRepository) {}

  async refundPayment(
    reference: string,
    verification: Pick<
      KoraVerifyResponse,
      "amount" | "currency" | "paid_at" | "payment_reference" | "reference" | "status"
    >,
    rawVerificationResponse: unknown,
    reason = "Seat reservation expired before payment was completed",
  ) {
    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment || existingPayment.status !== "expired") {
      return existingPayment
        ? enrichWithExpiry(existingPayment)
        : null;
    }

    // Prevents double refund: only one request creates the pending refund
    // inside the lock. The Kora API call runs after the lock is released.
    const pendingRefund = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(payment)
        .where(eq(payment.id, existingPayment.id))
        .for("update")
        .limit(1);

      if (!locked || locked.status !== "expired") return null as RefundRecord | null;

      const existing = await tx.query.refund.findFirst({
        where: and(
          eq(refund.paymentId, locked.id),
          eq(refund.status, "pending"),
        ),
        orderBy: (ref, { desc }) => [desc(ref.createdAt)],
      });
      if (existing) return existing;

      const [row] = await this.repo.insertRefund(tx, {
        paymentId: existingPayment.id,
        bookingId: existingPayment.bookingId,
        reference: generateReference(),
        amount: existingPayment.amount,
        currency: existingPayment.currency,
        reason,
        status: "pending",
        initiatedBy: "auto",
      });
      return row;
    });

    if (!pendingRefund) {
      return existingPayment ? enrichWithExpiry(existingPayment) : null;
    }

    let refundResult: Awaited<ReturnType<typeof this.kora.initiateRefund>>;
    try {
      refundResult = await this.kora.initiateRefund({
        reference: pendingRefund.reference,
        payment_reference: existingPayment.reference,
        amount: existingPayment.amount,
        reason,
      });
    } catch (error) {
      await db.transaction(async (tx) => {
        await this.repo.updateRefundStatus(tx, pendingRefund.id, {
          status: "failed",
          failureReason: error instanceof Error ? error.message : String(error),
          completedAt: new Date(),
        });

        if (existingPayment.bookingId) {
          await tx
            .update(booking)
            .set({ paymentStatus: "refund_failed", updatedAt: new Date() })
            .where(eq(booking.id, existingPayment.bookingId));
        }

        await this.sendRefundFailureEmail(existingPayment, reason, tx);
      });

      throw error;
    }

    await db.transaction(async (tx) => {
      await this.repo.updateRefundStatus(tx, pendingRefund.id, {
        status: "successful",
        providerRefundReference: refundResult.data.reference,
        providerStatus: refundResult.data.status,
        rawProviderResponse: refundResult.raw,
        completedAt: new Date(),
      });

      if (!existingPayment.bookingId) return;

      const bookingResult = await this.repo.updateBookingPaymentStatus(tx, {
        bookingId: existingPayment.bookingId,
        paymentReference: reference,
        paymentStatus: "expired",
      });

      const earningRecord = await tx.query.earning.findFirst({
        where: eq(earning.bookingId, existingPayment.bookingId),
      });

      await tx
        .update(earning)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(earning.bookingId, existingPayment.bookingId));

      if (bookingResult.cancelledConfirmed && bookingResult.booking) {
        await this.resolveAndCancelBookingStats(
          tx,
          bookingResult.booking,
          earningRecord,
        );
      } else if (earningRecord) {
        await this.driverService.adjustPaymentCountersForStatusChange(tx, {
          driverId: earningRecord.driverId,
          amountMinor: earningRecord.netAmountMinor,
          previousStatus: earningRecord.status,
          nextStatus: "cancelled",
        });
      }
    });

    logger.info("payment.auto_refund_initiated", {
      reference,
      amount: existingPayment.amount,
    });

    return enrichWithExpiry(existingPayment);
  }

  async finalizeRefund(
    paymentReference: string,
    status: "refunded" | "refund_failed",
  ) {
    const existingPayment = await this.repo.findPaymentByReference(
      paymentReference,
    );
    if (!existingPayment) return;

    // Prevents two finalize calls from processing the same refund concurrently.
    // Re-reading under lock ensures only the first sees "pending" status.
    await db.transaction(async (tx) => {
      const [lockedPayment] = await tx
        .select()
        .from(payment)
        .where(eq(payment.reference, paymentReference))
        .for("update")
        .limit(1);
      if (!lockedPayment) return;

      const pendingRefund = await tx.query.refund.findFirst({
        where: and(
          eq(refund.paymentId, lockedPayment.id),
          eq(refund.status, "pending"),
        ),
        orderBy: (ref, { desc }) => [desc(ref.createdAt)],
      });
      if (!pendingRefund) {
        logger.warn("payment.finalize_refund_no_pending_row", {
          paymentReference,
        });
        return;
      }

      await this.repo.updateRefundStatus(tx, pendingRefund.id, {
        status: status === "refunded" ? "successful" : "failed",
        completedAt: new Date(),
      });

      const [bookingRecord] = await tx
        .update(booking)
        .set({ paymentStatus: status, updatedAt: new Date() })
        .where(eq(booking.paymentReference, paymentReference))
        .returning();

      if (
        bookingRecord &&
        bookingRecord.status === "confirmed" &&
        bookingRecord.seatNumber !== null
      ) {
        const earningRecord = await tx.query.earning.findFirst({
          where: eq(earning.bookingId, bookingRecord.id),
        });

        await tx
          .update(earning)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(earning.bookingId, bookingRecord.id));

        if (status === "refunded") {
          await this.resolveAndCancelBookingStats(
            tx,
            bookingRecord,
            earningRecord,
          );
        } else if (earningRecord) {
          await this.driverService.adjustPaymentCountersForStatusChange(tx, {
            driverId: earningRecord.driverId,
            amountMinor: earningRecord.netAmountMinor,
            previousStatus: earningRecord.status,
            nextStatus: "cancelled",
          });
        }

        if (bookingRecord.tripId) {
          await tx
            .update(trip)
            .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
            .where(eq(trip.id, bookingRecord.tripId));
        }
      }
    });
  }

  async sendRefundFailureEmail(
    paymentRecord: PaymentRecord,
    failureReason: string,
    tx?: PaymentTransaction,
  ) {
    if (!paymentRecord.customerEmail) return;

    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName: paymentRecord.customerName || null,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      bookingId: paymentRecord.bookingId,
      amountMinor: toMinorAmount(paymentRecord.amount),
      currency: paymentRecord.currency,
      productName: paymentRecord.productName,
      failureReason,
      supportEmail: "support@dailyexpress.app",
      supportPhone: this.config.SUPPORT_PHONE,
    });
    const html = await renderEmail("RefundFailedEmail", propsJson);
    const subject = getEmailSubject("RefundFailedEmail", propsJson);

    if (tx) {
      await jobService.enqueueEmail(tx, "email.refund_failed", {
        to: paymentRecord.customerEmail,
        subject,
        html,
      });
    } else {
      await db.transaction(async (tx) => {
        await jobService.enqueueEmail(tx, "email.refund_failed", {
          to: paymentRecord.customerEmail || "",
          subject,
          html,
        });
      });
    }
  }

  async sendTripCancelledEmail(
    paymentRecord: PaymentRecord,
    refundReference: string,
    reason?: "driver_deactivated" | "no_driver_found" | "admin_cancelled",
    tx?: PaymentTransaction,
  ) {
    if (!paymentRecord.customerEmail) return;

    const amountMinor = toMinorAmount(paymentRecord.amount);
    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      customerName: paymentRecord.customerName || null,
      customerEmail: paymentRecord.customerEmail,
      paymentReference: paymentRecord.reference,
      productName: paymentRecord.productName,
      amountMinor,
      currency: paymentRecord.currency,
      refundReference,
      reason,
      supportEmail: "support@dailyexpress.app",
      supportPhone: this.config.SUPPORT_PHONE,
    });
    const html = await renderEmail("TripCancelledEmail", propsJson);
    const subject = getEmailSubject("TripCancelledEmail", propsJson);

    if (tx) {
      await jobService.enqueueEmail(tx, "email.trip_cancelled_refund", {
        to: paymentRecord.customerEmail,
        subject,
        html,
      });
    } else {
      await db.transaction(async (tx) => {
        await jobService.enqueueEmail(tx, "email.trip_cancelled_refund", {
          to: paymentRecord.customerEmail || "",
          subject,
          html,
        });
      });
    }
  }

  async refundConfirmedBooking(
    paymentRecord: PaymentRecord,
    reason = "Trip cancelled because driver deactivated their account",
    emailReason?: "driver_deactivated" | "no_driver_found" | "admin_cancelled",
    existingRefundReference?: string,
  ): Promise<void> {
    if (paymentRecord.status !== "successful") return;

    let pendingRefund: RefundRecord | null = null;

    if (existingRefundReference) {
      pendingRefund = (await this.repo.findRefundByReference(existingRefundReference)) ?? null;
    }

    if (!pendingRefund) {
      // Prevents double refund for the same payment. Same short-lock pattern
      // as refundPayment above — Kora API call is outside the lock.
      pendingRefund = await db.transaction(async (tx) => {
        const [locked] = await tx
          .select()
          .from(payment)
          .where(eq(payment.id, paymentRecord.id))
          .for("update")
          .limit(1);

        if (!locked || locked.status !== "successful") return null;

        const existing = await tx.query.refund.findFirst({
          where: and(
            eq(refund.paymentId, locked.id),
            eq(refund.status, "pending"),
          ),
        });
        if (existing) return existing;

        const [row] = await this.repo.insertRefund(tx, {
          paymentId: paymentRecord.id,
          bookingId: paymentRecord.bookingId,
          reference: generateReference(),
          amount: paymentRecord.amount,
          currency: paymentRecord.currency,
          reason,
          status: "pending",
          initiatedBy: "auto",
        });
        return row;
      });
    }

    if (!pendingRefund) return;

    const refundResult = await this.kora.initiateRefund({
      reference: pendingRefund.reference,
      payment_reference: paymentRecord.reference,
      amount: paymentRecord.amount,
      reason,
    });

    await db.transaction(async (tx) => {
      await this.repo.updateRefundStatus(tx, pendingRefund.id, {
        status: "successful",
        providerRefundReference: refundResult.data.reference,
        providerStatus: refundResult.data.status,
        rawProviderResponse: refundResult.raw,
        completedAt: new Date(),
      });

      if (paymentRecord.bookingId) {
        const bookingRecord = await tx.query.booking.findFirst({
          where: eq(booking.id, paymentRecord.bookingId),
        });

        if (bookingRecord) {
          const wasConfirmed = bookingRecord.status === "confirmed";

          await tx
            .update(booking)
            .set({
              paymentStatus: "refund_pending",
              seatNumber: null,
              updatedAt: new Date(),
            })
            .where(eq(booking.id, paymentRecord.bookingId));

          if (wasConfirmed && bookingRecord.tripId) {
            await tx
              .update(trip)
              .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
              .where(
                and(eq(trip.id, bookingRecord.tripId), gt(trip.bookedSeats, 0)),
              );
          }

          const earningRecord = await tx.query.earning.findFirst({
            where: eq(earning.bookingId, paymentRecord.bookingId),
          });

          await tx
            .update(earning)
            .set({ status: "cancelled", updatedAt: new Date() })
            .where(eq(earning.bookingId, paymentRecord.bookingId));

          if (wasConfirmed) {
            await this.resolveAndCancelBookingStats(
              tx,
              bookingRecord,
              earningRecord,
            );
          } else if (earningRecord) {
            await this.driverService.adjustPaymentCountersForStatusChange(tx, {
              driverId: earningRecord.driverId,
              amountMinor: earningRecord.netAmountMinor,
              previousStatus: earningRecord.status,
              nextStatus: "cancelled",
            });
          }
        }
      }

      await this.sendTripCancelledEmail(
        paymentRecord,
        pendingRefund.reference,
        emailReason,
        tx,
      );
    });

    logger.info("payment.driver_deactivation_refund_initiated", {
      reference: paymentRecord.reference,
      amount: paymentRecord.amount,
    });
  }

  private async resolveAndCancelBookingStats(
    tx: PaymentTransaction,
    bookingRecord: BookingRecord,
    existingEarning?: typeof earning.$inferSelect | null,
  ) {
    const earningRecord =
      existingEarning ??
      (await tx.query.earning.findFirst({
        where: eq(earning.bookingId, bookingRecord.id),
      }));
    const driverId =
      earningRecord?.driverId ??
      (bookingRecord.tripId
        ? (
            await tx.query.trip.findFirst({
              where: eq(trip.id, bookingRecord.tripId),
              columns: { driverId: true },
            })
          )?.driverId
        : undefined);

    if (!driverId) return;

    await this.driverService.decrementStatsForCancelledBooking(tx, {
      driverId,
      amountMinor:
        earningRecord?.netAmountMinor ?? toMinorAmount(bookingRecord.fareAmount),
      previousEarningStatus: earningRecord?.status ?? null,
    });
  }

}

export const paymentRefundService = new PaymentRefundService();
