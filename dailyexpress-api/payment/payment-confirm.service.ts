import { getEmailSubject, renderEmail } from "@repo/email";
import { and, eq } from "drizzle-orm";
import { getConfig } from "../config/index";
import { db } from "../db/connection";
import { payment } from "../db/index";
import { DriverService } from "../driver/driverService";
import { NotificationService } from "../notification/notificationService";
import { publishNotificationCreatedInBackground } from "../notification/realtime";
import { PayoutService } from "../payout/payoutService";
import { logger } from "../utils/logger";
import {
    formatMajorAmount,
    formatTripDate,
    formatTripTime,
    parseDate,
    toMinorAmount,
} from "../utils/payment";
import { jobService } from "../workers/jobService";
import { KoraClient } from "./kora.client";
import { PaymentRepository } from "./payment.repository";
import type { KoraVerifyResponse } from "./payment.types";
import { enrichWithExpiry } from "./payment.utils";

type PaymentTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymentRecord = typeof payment.$inferSelect;

export class PaymentConfirmService {
  private readonly config = getConfig();
  private readonly kora = new KoraClient();
  private readonly driverService = new DriverService();
  private readonly notificationService = new NotificationService();

  constructor(
    private repo: PaymentRepository,
    private payoutService: PayoutService,
  ) {}

  async confirmPayment(
    reference: string,
    verification: KoraVerifyResponse,
    rawVerificationResponse: unknown,
  ) {
    const existingPayment = await this.repo.findPaymentByReference(reference);
    if (!existingPayment) return null;

    if (existingPayment.status !== "pending") {
      return enrichWithExpiry(existingPayment);
    }

    const paidAt =
      parseDate(verification.paid_at) ||
      parseDate(verification.transaction_date) ||
      new Date();
    const sideEffects = await this.prepareConfirmationData(
      existingPayment,
      verification,
      paidAt,
    );

    const result = await db.transaction(async (tx) => {
      const [updatedPayment] = await tx
        .update(payment)
        .set({
          status: "successful",
          providerStatus: verification.status,
          providerTransactionId:
            verification.payment_reference ||
            verification.reference ||
            existingPayment.providerTransactionId,
          rawVerificationResponse,
          lastStatusCheckAt: new Date(),
          paidAt,
          failedAt: null,
          failureCode: null,
          failureReason: null,
          updatedAt: new Date(),
        })
        .where(
          and(eq(payment.reference, reference), eq(payment.status, "pending")),
        )
        .returning();

      if (!updatedPayment) return null;

      const bookingResult = await this.repo.updateBookingPaymentStatus(tx, {
        bookingId: updatedPayment.bookingId,
        paymentReference: reference,
        paymentStatus: "successful",
      });

      if (bookingResult.confirmed && sideEffects) {
        await this.driverService.recordNewBookingForDriver(tx, {
          driverId: sideEffects.driverId,
          fareAmountMinor: sideEffects.fareAmountMinor,
        });

        await this.payoutService.createEarningForConfirmedBookingInTransaction(
          tx,
          {
            bookingId: sideEffects.bookingId,
            tripId: sideEffects.tripId,
            routeId: sideEffects.routeId,
            driverId: sideEffects.driverId,
            tripDate: sideEffects.tripDate,
            pickupTitle: sideEffects.pickupTitle,
            dropoffTitle: sideEffects.dropoffTitle,
            fareAmountMinor: sideEffects.fareAmountMinor,
            currency: updatedPayment.currency,
            sourceEventId: `payment:${reference}:booking-confirmed`,
          },
        );

        const notification =
          await this.notificationService.createForDriverInTransaction(
            tx,
            sideEffects.driverId,
            sideEffects.notification,
          );

        if (sideEffects.email.to) {
          await jobService.enqueueEmail(tx, "email.booking_confirmed", {
            to: sideEffects.email.to,
            subject: sideEffects.email.subject,
            html: sideEffects.email.html,
          });
        }

        return { payment: updatedPayment, notification };
      }

      return { payment: updatedPayment, notification: null };
    });

    if (!result) {
      const latest = await this.repo.findPaymentByReference(reference);
      return latest ? enrichWithExpiry(latest) : null;
    }

    if (result.notification) {
      publishNotificationCreatedInBackground(result.notification);
    }

    logger.info("payment.confirmed", {
      bookingId: result.payment.bookingId,
      reference,
    });

    return enrichWithExpiry(result.payment, null);
  }

  private async prepareConfirmationData(
    paymentRecord: PaymentRecord,
    verification: KoraVerifyResponse,
    paidAt: Date,
  ) {
    if (!paymentRecord.bookingId) return null;

    const bookingDetails = await this.repo.findBookingDetailsByBookingId(
      paymentRecord.bookingId,
    );
    if (!bookingDetails) return null;

    const { booking: bookingRecord, trip: tripRecord, route: routeRecord } =
      bookingDetails;
    const passenger = bookingDetails.passenger;
    const driverRecord = bookingDetails.driver;
    const passengerName = passenger
      ? `${passenger.firstName} ${passenger.lastName}`.trim()
      : null;
    const tripDateLabel = formatTripDate(tripRecord.date);
    const departureTimeLabel = formatTripTime(routeRecord.departure_time);
    const propsJson = JSON.stringify({
      frontendUrl: this.config.FRONTEND_URL,
      passengerName,
      paymentReference: paymentRecord.reference,
      pricePaid: formatMajorAmount(
        paymentRecord.amount,
        paymentRecord.currency,
      ),
      pickupTitle: routeRecord.pickup_location_title,
      dropoffTitle: routeRecord.dropoff_location_title,
      tripDate: tripDateLabel,
      departureTime: departureTimeLabel,
      timeZone: this.config.ROUTE_SERVICE_TIMEZONE,
      vehicleType: routeRecord.vehicleType,
      seatNumber: bookingRecord.seatNumber ?? 0,
      meetingPoint: routeRecord.meeting_point,
      driverName: driverRecord
        ? `${driverRecord.firstName} ${driverRecord.lastName}`.trim()
        : null,
      driverPhone: driverRecord?.phone || null,
    });
    const html = await renderEmail("BookingConfirmedEmail", propsJson);

    return {
      bookingId: bookingRecord.id,
      tripId: tripRecord.id,
      routeId: routeRecord.id,
      driverId: tripRecord.driverId,
      fareAmountMinor: toMinorAmount(bookingRecord.fareAmount),
      tripDate: tripRecord.date,
      pickupTitle: routeRecord.pickup_location_title,
      dropoffTitle: routeRecord.dropoff_location_title,
      notification: {
        notificationKey: `event:${paymentRecord.reference}:booking-confirmed`,
        kind: "event" as const,
        type: "booking_confirmed",
        title: "New booking confirmed",
        message: passengerName
          ? `This trip was booked by ${passengerName} for ${tripDateLabel} at ${departureTimeLabel}.`
          : `This trip was booked for ${tripDateLabel} at ${departureTimeLabel}.`,
        href: "/routes",
        tag: "Booking",
        tone: "positive" as const,
        metadata: {
          bookingId: bookingRecord.id,
          tripId: tripRecord.id,
          routeId: routeRecord.id,
          paymentReference: paymentRecord.reference,
          providerPaymentReference: verification.payment_reference || null,
        },
        occurredAt: paidAt,
      },
      email: {
        to: paymentRecord.customerEmail || passenger?.email || "",
        subject: getEmailSubject("BookingConfirmedEmail", propsJson),
        html,
      },
    };
  }

}
