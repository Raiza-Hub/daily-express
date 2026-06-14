import { getEmailSubject, renderEmail } from "@repo/email";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { booking, earning, payment, trip } from "../db/index";
import { DriverService } from "../driver/driverService";
import { logger } from "../utils/logger";
import { generateReference, toMinorAmount } from "../utils/payment";
import { jobService } from "../workers/jobService";
import { KoraClient } from "./kora.client";
import { PaymentRepository } from "./payment.repository";
import type { KoraVerifyResponse } from "./payment.types";
import { enrichWithExpiry } from "./payment.utils";

type PaymentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymentRecord = typeof payment.$inferSelect;
type BookingRecord = typeof booking.$inferSelect;

export class PaymentRefundService {
  private readonly config = getConfig();
  private readonly kora = new KoraClient();
  private readonly driverService = new DriverService();

  constructor(private repo: PaymentRepository) {}

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

    let refundResult: Awaited<ReturnType<typeof this.kora.initiateRefund>>;
    try {
      refundResult = await this.kora.initiateRefund({
        reference: generateReference(),
        payment_reference: existingPayment.reference,
        reason,
      });
    } catch (error) {
      await db.transaction(async (tx) => {
        await tx
          .update(payment)
          .set({ status: "refund_failed", updatedAt: new Date() })
          .where(
            and(
              eq(payment.id, existingPayment.id),
              inArray(payment.status, [
                "pending",
                "successful",
                "failed",
                "expired",
              ]),
            ),
          );

        if (existingPayment.bookingId) {
          await tx
            .update(booking)
            .set({ paymentStatus: "refund_failed", updatedAt: new Date() })
            .where(eq(booking.id, existingPayment.bookingId));
        }
      });

      await this.sendRefundFailureEmail(existingPayment, reason);
      throw error;
    }

    const [updatedPayment] = await db.transaction(async (tx) => {
      const [record] = await tx
        .update(payment)
        .set({
          status: "refund_pending",
          failureCode: "AUTO_REFUND_INITIATED",
          failureReason: reason,
          updatedAt: new Date(),
          metadata: sql`COALESCE(${payment.metadata},'{}'::jsonb)||${JSON.stringify({
            refundReference: refundResult.data.reference,
            refundStatus: refundResult.data.status,
            refundInitiatedAt: new Date().toISOString(),
            rawRefundResponse: refundResult.raw,
          })}::jsonb`,
        })
        .where(
          and(
            eq(payment.reference, reference),
            eq(payment.status, "expired"),
          ),
        )
        .returning();

      if (!record || !record.bookingId) return [];

      const bookingResult = await this.repo.updateBookingPaymentStatus(tx, {
        bookingId: record.bookingId,
        paymentReference: reference,
        paymentStatus: "expired",
      });

      if (record.bookingId) {
        const earningRecord = await tx.query.earning.findFirst({
          where: eq(earning.bookingId, record.bookingId),
        });

        await tx
          .update(earning)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(eq(earning.bookingId, record.bookingId));

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
      }

      return [record];
    });

    if (!updatedPayment) {
      logger.error("payment.auto_refund_db_failed_after_api", { reference });
      return null;
    }

    logger.info("payment.auto_refund_initiated", {
      reference,
      amount: existingPayment.amount,
    });

    return enrichWithExpiry(updatedPayment);
  }

  async finalizeRefund(reference: string, status: "refunded" | "refund_failed") {
    await db.transaction(async (tx) => {
      await tx
        .update(payment)
        .set({
          status,
          updatedAt: new Date(),
          metadata: sql`COALESCE(${payment.metadata},'{}'::jsonb)||${JSON.stringify({
            refundCompletedAt: new Date().toISOString(),
            refundFinalStatus: status,
          })}::jsonb`,
        })
        .where(eq(payment.reference, reference));

      const [bookingRecord] = await tx
        .update(booking)
        .set({ paymentStatus: status, updatedAt: new Date() })
        .where(eq(booking.paymentReference, reference))
        .returning();

      //Incase a refund is manually triggered from Kora dashoard
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

        await tx
          .update(trip)
          .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
          .where(eq(trip.id, bookingRecord.tripId));
      }
    });
  }

  async sendRefundFailureEmail(
    paymentRecord: PaymentRecord,
    failureReason: string,
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
      supportPhone: "+234 9063611541",
    });
    const html = await renderEmail("RefundFailedEmail", propsJson);

    await db.transaction(async (tx) => {
      await jobService.enqueueEmail(tx, "email.refund_failed", {
        to: paymentRecord.customerEmail || "",
        subject: getEmailSubject("RefundFailedEmail", propsJson),
        html,
      });
    });
  }

  async sendTripCancelledEmail(
    paymentRecord: PaymentRecord,
    refundReference: string,
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
      supportEmail: "support@dailyexpress.app",
      supportPhone: "+234 9063611541",
    });
    const html = await renderEmail("TripCancelledEmail", propsJson);

    await db.transaction(async (tx) => {
      await jobService.enqueueEmail(tx, "email.trip_cancelled_refund", {
        to: paymentRecord.customerEmail || "",
        subject: getEmailSubject("TripCancelledEmail", propsJson),
        html,
      });
    });
  }

  async refundConfirmedBooking(
    paymentRecord: PaymentRecord,
    reason = "Trip cancelled because driver deactivated their account",
  ): Promise<void> {
    if (paymentRecord.status !== "successful") {
      return;
    }

    const refundReference = generateReference();

    let refundResult: Awaited<ReturnType<typeof this.kora.initiateRefund>>;
    try {
      refundResult = await this.kora.initiateRefund({
        reference: refundReference,
        payment_reference: paymentRecord.reference,
        reason,
      });
    } catch (error) {
      await db.transaction(async (tx) => {
        await tx
          .update(payment)
          .set({ status: "refund_failed", updatedAt: new Date() })
          .where(
            and(eq(payment.id, paymentRecord.id), eq(payment.status, "successful")),
          );

        if (paymentRecord.bookingId) {
          await tx
            .update(booking)
            .set({ paymentStatus: "refund_failed", updatedAt: new Date() })
            .where(eq(booking.id, paymentRecord.bookingId));
        }
      });

      await this.sendRefundFailureEmail(paymentRecord, reason);
      throw error;
    }

    await db.transaction(async (tx) => {
      const [record] = await tx
        .update(payment)
        .set({
          status: "refund_pending",
          failureCode: "DRIVER_DEACTIVATION_REFUND",
          failureReason: reason,
          updatedAt: new Date(),
          metadata: sql`COALESCE(${payment.metadata},'{}'::jsonb)||${JSON.stringify({
            refundReference: refundResult.data.reference,
            refundStatus: refundResult.data.status,
            refundInitiatedAt: new Date().toISOString(),
            rawRefundResponse: refundResult.raw,
          })}::jsonb`,
        })
        .where(
          and(
            eq(payment.reference, paymentRecord.reference),
            eq(payment.status, "successful"),
          ),
        )
        .returning();

      if (!record || !record.bookingId) return;

      const bookingRecord = await tx.query.booking.findFirst({
        where: eq(booking.id, record.bookingId),
      });

      if (!bookingRecord) return;

      const wasConfirmed = bookingRecord.status === "confirmed";

      await tx
        .update(booking)
        .set({
          paymentStatus: "refund_pending",
          seatNumber: null,
          updatedAt: new Date(),
        })
        .where(eq(booking.id, record.bookingId));

      if (wasConfirmed) {
        await tx
          .update(trip)
          .set({ bookedSeats: sql`GREATEST(${trip.bookedSeats} - 1, 0)` })
          .where(
            and(eq(trip.id, bookingRecord.tripId), gt(trip.bookedSeats, 0)),
          );
      }

      const earningRecord = await tx.query.earning.findFirst({
        where: eq(earning.bookingId, record.bookingId),
      });

      await tx
        .update(earning)
        .set({ status: "cancelled", updatedAt: new Date() })
        .where(eq(earning.bookingId, record.bookingId));

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
    });

    await this.sendTripCancelledEmail(paymentRecord, refundReference);

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
      (
        await tx.query.trip.findFirst({
          where: eq(trip.id, bookingRecord.tripId),
          columns: { driverId: true },
        })
      )?.driverId;

    if (!driverId) return;

    await this.driverService.decrementStatsForCancelledBooking(tx, {
      driverId,
      amountMinor:
        earningRecord?.netAmountMinor ?? toMinorAmount(bookingRecord.fareAmount),
      previousEarningStatus: earningRecord?.status ?? null,
    });
  }

}
