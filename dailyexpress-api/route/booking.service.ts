import type { CreateBooking } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { and, desc, eq, getTableColumns, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, driver, externalDriver, route, trip, users, vehicle, type BookingRecord, type TripRecord, type RouteRecord } from "../db/index";
import { logger } from "../utils/logger";
import {
    formatBusinessDate,
    getBusinessDayWindow,
    getScheduledDepartureTime,
    HIDDEN_BOOKING_PAYMENT_STATUSES,
} from "../utils/route";
import { timeAsync } from "../utils/timing";
import { RouteRepository, routeRepository } from "./route.repository";
import {
    normalizePageLimit,
    decodeCursor,
    encodeCursor,
    isValidUserBookingsCursor,
    VISIBLE_BOOKING_STATUSES,
} from "./utils";


export class BookingService {
  constructor(private repo: RouteRepository) {}

  async createCheckoutBooking(userId: string, input: CreateBooking) {
    const passengerRecord = await this.repo.findUserById(userId);
    if (!passengerRecord) {
      throw createServiceError("Passenger not found", 404);
    }

    const routeRecord = await this.repo.findRouteById(input.routeId);
    if (!routeRecord) throw createServiceError("Route not found", 404);
    if (routeRecord.status !== "active") {
      throw createServiceError("Route is not open for booking", 400);
    }

    const scheduledDepartureTime = getScheduledDepartureTime(
      input.tripDate,
      routeRecord.departure_time,
    );
    if (scheduledDepartureTime <= new Date()) {
      throw createServiceError(
        "This trip has already departed and can no longer be booked",
        400,
      );
    }

    const { start } = getBusinessDayWindow(input.tripDate);

    const fareAmount =
      input.vehicleType === "car" ? routeRecord.priceCar : routeRecord.priceBus;

    const existingBooking = await db.query.booking.findFirst({
      where: and(
        eq(booking.routeId, routeRecord.id),
        eq(booking.tripDate, start),
        eq(booking.userId, userId),
        eq(booking.vehicleType, input.vehicleType),
        inArray(booking.status, ["pending", "confirmed"]),
      ),
    });

    if (existingBooking) {
      const notExpired = existingBooking.expiresAt && existingBooking.expiresAt.getTime() > Date.now();

      if (existingBooking.status === "confirmed" || notExpired) {
        await db
          .update(booking)
          .set({ fareAmount, updatedAt: new Date() })
          .where(eq(booking.id, existingBooking.id));

        logger.info("booking.reused", {
          bookingId: existingBooking.id,
          routeId: existingBooking.routeId,
          userId,
        });
        return {
          booking: { ...existingBooking, fareAmount },
          fareAmount,
          currency: existingBooking.currency,
          expiresAt: existingBooking.expiresAt,
        };
      }

      await db
        .update(booking)
        .set({
          status: "cancelled",
          paymentStatus: "expired",
          updatedAt: new Date(),
        })
        .where(eq(booking.id, existingBooking.id));

      logger.info("booking.expired_replaced", {
        bookingId: existingBooking.id,
        routeId: existingBooking.routeId,
        userId,
      });
    }

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

    let newBooking: BookingRecord;
    try {
      [newBooking] = await db.insert(booking).values({
        routeId: routeRecord.id,
        tripDate: start,
        vehicleType: input.vehicleType,
        userId,
        firstName: passengerRecord.firstName,
        lastName: passengerRecord.lastName,
        fareAmount,
        currency: "NGN",
        status: "pending",
        expiresAt,
      }).returning();
    } catch (err: any) {
      if (err?.code === "23505") {
        const existing = await db.query.booking.findFirst({
          where: and(
            eq(booking.routeId, routeRecord.id),
            eq(booking.tripDate, start),
            eq(booking.userId, userId),
            eq(booking.vehicleType, input.vehicleType),
            inArray(booking.status, ["pending", "confirmed"]),
          ),
        });
        if (existing) {
          logger.warn("booking.duplicate_prevented", {
            bookingId: existing.id,
            routeId: existing.routeId,
            userId,
          });
          return {
            booking: existing,
            fareAmount: existing.fareAmount,
            currency: existing.currency,
            expiresAt: existing.expiresAt,
          };
        }
      }
      throw err;
    }

    logger.info("booking.created", {
      bookingId: newBooking.id,
      routeId: newBooking.routeId,
      vehicleType: newBooking.vehicleType,
      fareAmount: newBooking.fareAmount,
      expiresAt: newBooking.expiresAt?.toISOString(),
    });

    return {
      booking: newBooking,
      fareAmount: newBooking.fareAmount,
      currency: newBooking.currency,
      expiresAt: newBooking.expiresAt,
    };
  }

  async getUserBookings(userId: string, limit = 20, cursor?: string) {
    const parsedLimit = normalizePageLimit(limit);
    const decodedCursor = decodeCursor(cursor, isValidUserBookingsCursor);
    const visibleBookingConditions = and(
      eq(booking.userId, userId),
      inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
      notInArray(booking.paymentStatus, ["failed", "cancelled", "expired"]),
    );
    const cursorCondition = decodedCursor
      ? lt(booking.createdAt, new Date(decodedCursor.createdAt))
      : undefined;
    const bookingRows = await timeAsync(
      "route.get_user_bookings.query_bookings",
      { userId, limit: parsedLimit, hasCursor: Boolean(cursor) },
      () =>
        db
          .select({
            booking: getTableColumns(booking),
            trip: getTableColumns(trip),
            route: getTableColumns(route),
            driver: getTableColumns(driver),
            externalDriver: getTableColumns(externalDriver),
            vehicle: getTableColumns(vehicle),
          })
          .from(booking)
          .innerJoin(route, eq(booking.routeId, route.id))
          .leftJoin(trip, eq(booking.tripId, trip.id))
          .leftJoin(driver, eq(trip.driverId, driver.id))
          .leftJoin(vehicle, eq(vehicle.driverId, driver.id))
          .leftJoin(externalDriver, eq(externalDriver.tripId, trip.id))
          .where(
            and(
              visibleBookingConditions,
              ne(trip.status, "cancelled"),
              cursorCondition,
            ),
          )
          .orderBy(desc(booking.createdAt))
          .limit(parsedLimit + 1),
    );
    const pageBookingRows = bookingRows.slice(0, parsedLimit);
    const nextBookingRow = bookingRows[parsedLimit];
    const lastBookingRow = pageBookingRows[pageBookingRows.length - 1];

    const bookings = pageBookingRows.map((row) => {
      let driverStatus: "assigned" | "overdue" | "awaiting" | "unassigned";
      let displayMessage: string | null;
      let driverInfo: Record<string, unknown> | null;

      if (!row.trip) {
        driverStatus = "unassigned";
        displayMessage = "Booking confirmed. Assigning trip shortly.";
        driverInfo = null;
      } else {
        const dateKey = formatBusinessDate(row.trip.date);
        const scheduledDeparture = getScheduledDepartureTime(
          dateKey,
          row.route.departure_time,
        );
        const hasDeparted = scheduledDeparture <= new Date();

        if (row.driver) {
          driverStatus = "assigned";
          displayMessage = null;
          driverInfo = {
            source: "platform",
            firstName: row.driver.firstName,
            lastName: row.driver.lastName,
            phoneNumber: row.driver.phone,
            profilePictureUrl: row.driver.profile_pic ?? null,
            country: row.driver.country,
            state: row.driver.state,
            vehicleMake: row.vehicle?.make ?? "",
            vehicleModel: row.vehicle?.model ?? "",
            vehiclePlateNumber: row.vehicle?.plateNumber ?? "",
            vehicleColor: row.vehicle?.color ?? "",
          };
        } else if (row.externalDriver) {
          driverStatus = "assigned";
          displayMessage = null;
          driverInfo = {
            source: "external",
            firstName: row.externalDriver.firstName,
            lastName: row.externalDriver.lastName,
            phoneNumber: row.externalDriver.phone,
            country: row.externalDriver.country ?? "",
            state: row.externalDriver.state ?? "",
            vehicleMake: row.externalDriver.vehicleMake ?? "",
            vehicleModel: row.externalDriver.vehicleModel ?? "",
            vehiclePlateNumber: row.externalDriver.vehiclePlateNumber ?? "",
            vehicleColor: row.externalDriver.vehicleColor ?? "",
          };
        } else if (hasDeparted) {
          driverStatus = "overdue";
          displayMessage =
            "We weren't able to confirm a driver in time for departure. We'll continue searching for the next 30 minutes. If unsuccessful, your payment will be refunded automatically.";
          driverInfo = null;
        } else {
          driverStatus = "awaiting";
          displayMessage =
            "We're matching you with a nearby driver. This usually takes a few minutes, and we'll email you as soon as a driver is confirmed.";
          driverInfo = null;
        }
      }

      return {
        id: row.booking.id,
        seatNumber: row.booking.seatNumber ?? 0,
        fareAmount: row.booking.fareAmount,
        currency: row.booking.currency,
        status: row.booking.status,
        paymentReference: row.booking.paymentReference ?? null,
        paymentStatus: row.booking.paymentStatus,
        createdAt: row.booking.createdAt,
        updatedAt: row.booking.updatedAt,
        tripId: row.booking.tripId,
        driverStatus,
        displayMessage,
        driverInfo,
        trip: row.trip
          ? {
              id: row.trip.id,
              date: row.trip.date,
              status: row.trip.status,
              bookedSeats: row.trip.bookedSeats,
              capacity: row.trip.capacity,
              availableSeats: Math.max(
                row.trip.capacity - row.trip.bookedSeats,
                0,
              ),
              route: {
                id: row.route.id,
                pickup_location_title: row.route.pickup_location_title,
                pickup_location_locality:
                  row.route.pickup_location_locality,
                pickup_location_label: row.route.pickup_location_label,
                dropoff_location_title:
                  row.route.dropoff_location_title,
                dropoff_location_locality:
                  row.route.dropoff_location_locality,
                dropoff_location_label:
                  row.route.dropoff_location_label,
                price: row.booking.fareAmount,
                vehicle_type: row.booking.vehicleType,
                meeting_point: row.route.meeting_point,
                departure_time: row.route.departure_time,
                arrival_time: row.route.arrival_time,
              },
            }
          : null,
      };
    });

    return {
      bookings,
      nextCursor:
        nextBookingRow && lastBookingRow
          ? encodeCursor({
              createdAt: lastBookingRow.booking.createdAt.toISOString(),
            })
          : null,
    };
  }

  async searchBookingByRef(
    userId: string,
    paymentReference: string,
    lastName: string,
  ): Promise<BookingRecord | null> {
    const normalizedLastName = lastName.trim().toLowerCase();
    return this.repo.findBookingByPaymentRef(
      userId,
      paymentReference,
      normalizedLastName,
    );
  }

  async getTripBookings(user: { userId: string }, tripId: string) {
    const driverRecord = await this.repo.findDriverByUserId(user.userId);
    if (!driverRecord) {
      throw createServiceError("Driver not found", 404);
    }

    const bookingRows = await db
      .select({
        tripId: trip.id,
        booking: getTableColumns(booking),
        userProfilePicture: users.profilePictureUrl,
      })
      .from(trip)
      .leftJoin(
        booking,
        and(
          eq(booking.tripId, trip.id),
          eq(booking.status, "confirmed"),
          notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
        ),
      )
      .leftJoin(users, eq(users.id, booking.userId))
      .where(and(eq(trip.id, tripId), eq(trip.driverId, driverRecord.id)));

    if (bookingRows.length === 0) {
      throw createServiceError("Trip not found", 404);
    }

    return bookingRows.flatMap((row) =>
      row.booking
        ? [
            {
              id: row.booking.id,
              seatNumber: row.booking.seatNumber ?? 0,
              status: row.booking.status,
              paymentStatus: row.booking.paymentStatus,
              createdAt: row.booking.createdAt,
              user: {
                firstName: row.booking.firstName ?? "Passenger",
                lastName: row.booking.lastName ?? "",
                profilePictureUrl: row.userProfilePicture,
              },
            },
          ]
        : [],
    );
  }
}

export const bookingService = new BookingService(routeRepository);
