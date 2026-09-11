import type { CreateBooking } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { and, desc, eq, getTableColumns, inArray, lt, ne, notInArray, or } from "drizzle-orm";
import { db } from "../db/connection";
import { booking, driver, earning, passenger, route, trip, vehicle, type BookingRecord, type RouteRecord } from "../db/index";
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


function resolveTripSlot(
  routeRecord: RouteRecord,
  { tripType, selectedTime }: Pick<CreateBooking, "tripType" | "selectedTime">,
): { departureTime: string; arrivalTime: string } {
  const isArrival = tripType === "arrival";
  const picked = isArrival ? routeRecord.arrival_time : routeRecord.departure_time;
  const paired = isArrival ? routeRecord.departure_time : routeRecord.arrival_time;

  // departure_time / arrival_time are parallel: same index = same daily run.
  const index = picked.indexOf(selectedTime);
  if (index === -1) {
    throw createServiceError(
      `Selected ${tripType} time is not available for this route`,
      400,
    );
  }

  return isArrival
    ? { departureTime: paired[index], arrivalTime: selectedTime }
    : { departureTime: selectedTime, arrivalTime: paired[index] };
}

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

    const { departureTime, arrivalTime } =
      resolveTripSlot(routeRecord, input);

    const scheduledDepartureTime = getScheduledDepartureTime(
      input.tripDate,
      departureTime,
    );
    if (scheduledDepartureTime <= new Date()) {
      throw createServiceError(
        "This trip has already departed and can no longer be booked",
        400,
      );
    }

    const { start } = getBusinessDayWindow(input.tripDate);

    const luggageCount = input.passengers.filter(
      (traveler) => traveler.carriesLuggage,
    ).length;
    const passengerCount = input.passengers.length;
    const totalAmount =
      routeRecord.price * passengerCount +
      luggageCount * (routeRecord.luggage_fee ?? 0);
    const totalFee = (routeRecord.fee ?? 0) * passengerCount;

    const bookingLookup = () =>
      db.query.booking.findFirst({
        where: and(
          eq(booking.routeId, routeRecord.id),
          eq(booking.tripDate, start),
          eq(booking.userId, userId),
          eq(booking.departureTime, departureTime),
          inArray(booking.status, ["pending", "confirmed"]),
        ),
      });

    return db.transaction(async (tx) => {
      const existingBooking = await bookingLookup();

      if (existingBooking) {
        await tx
          .update(booking)
          .set({
            departureTime,
            arrivalTime,
            boardingPoint: input.boardingPoint,
            luggageCount,
            totalAmount,
            totalFee,
            updatedAt: new Date(),
          })
          .where(eq(booking.id, existingBooking.id));

        await this.repo.deletePassengersByBooking(tx, existingBooking.id);
        await this.repo.insertPassengers(
          tx,
          input.passengers.map((traveler) => ({
            bookingId: existingBooking.id,
            fullName: traveler.fullName,
            email: traveler.email,
            phone: traveler.phone,
            carriesLuggage: traveler.carriesLuggage,
          })),
        );

        logger.info("booking.reused", {
          bookingId: existingBooking.id,
          routeId: existingBooking.routeId,
          userId,
        });
        return {
          booking: {
            ...existingBooking,
            departureTime,
            arrivalTime,
            boardingPoint: input.boardingPoint,
            luggageCount,
            totalAmount,
            totalFee,
          },
          totalAmount,
          totalFee,
          currency: existingBooking.currency,
        };
      }

      let newBooking: BookingRecord;
      try {
        newBooking = await this.repo.insertBooking(tx, {
          routeId: routeRecord.id,
          tripDate: start,
          departureTime,
          arrivalTime,
          boardingPoint: input.boardingPoint,
          luggageCount,
          userId,
          totalAmount,
          totalFee,
          currency: "NGN",
          status: "pending",
        });
      } catch (err: any) {
        if (err?.code === "23505") {
          const existing = await bookingLookup();
          if (existing) {
            logger.warn("booking.duplicate_prevented", {
              bookingId: existing.id,
              routeId: existing.routeId,
              userId,
            });
            return {
              booking: existing,
              totalAmount: existing.totalAmount,
              totalFee: existing.totalFee,
              currency: existing.currency,
            };
          }
        }
        throw err;
      }

      await this.repo.insertPassengers(
        tx,
        input.passengers.map((traveler) => ({
          bookingId: newBooking.id,
          fullName: traveler.fullName,
          email: traveler.email,
          phone: traveler.phone,
          carriesLuggage: traveler.carriesLuggage,
        })),
      );

      logger.info("booking.created", {
        bookingId: newBooking.id,
        routeId: newBooking.routeId,
        tripId: newBooking.tripId,
        passengerCount,
        luggageCount,
        departureTime: newBooking.departureTime,
        boardingPoint: newBooking.boardingPoint,
        totalAmount: newBooking.totalAmount,
        totalFee: newBooking.totalFee,
      });

      return {
        booking: newBooking,
        totalAmount: newBooking.totalAmount,
        totalFee: newBooking.totalFee,
        currency: newBooking.currency,
      };
    });
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
      ? or(
          lt(booking.tripDate, new Date(decodedCursor.tripDate)),
          and(
            eq(booking.tripDate, new Date(decodedCursor.tripDate)),
            lt(booking.id, decodedCursor.id),
          ),
        )
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
            vehicle: getTableColumns(vehicle),
          })
          .from(booking)
          .innerJoin(route, eq(booking.routeId, route.id))
          .leftJoin(trip, eq(booking.tripId, trip.id))
          .leftJoin(driver, eq(trip.driverId, driver.id))
          .leftJoin(vehicle, eq(vehicle.driverId, driver.id))
          .where(
            and(
              visibleBookingConditions,
              or(
                ne(trip.status, "cancelled"),
                inArray(booking.paymentStatus, ["successful", "refund_pending", "refunded", "refund_failed"]),
              ),
              cursorCondition,
            ),
          )
          .orderBy(desc(booking.tripDate), desc(booking.id))
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
          row.booking.departureTime,
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
        totalAmount: row.booking.totalAmount,
        totalFee: row.booking.totalFee ?? 0,
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
                origin_title: row.route.origin_title,
                origin_locality: row.route.origin_locality,
                origin_label: row.route.origin_label,
                destination_title: row.route.destination_title,
                destination_locality: row.route.destination_locality,
                destination_label: row.route.destination_label,
                train_station_title: row.route.train_station_title,
                train_station_locality: row.route.train_station_locality,
                train_station_label: row.route.train_station_label,
                pickup_point: row.route.pickup_point,
                dropoff_point: row.route.dropoff_point,
                price: row.booking.totalAmount,
                departure_time: row.booking.departureTime,
                arrival_time: row.booking.arrivalTime,
                boardingPoint: row.booking.boardingPoint,
                luggageCount: row.booking.luggageCount,
                luggage_fee: row.route.luggage_fee,
              },
            }
          : null,
      };
    });

    return {
      bookings,
      nextCursor: nextBookingRow && lastBookingRow
        ? encodeCursor({
            tripDate: lastBookingRow.booking.tripDate.toISOString(),
            id: lastBookingRow.booking.id,
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

    const tripRecord = await this.repo.findTripWithRoute(tripId);
    if (!tripRecord || tripRecord.trip.driverId !== driverRecord.id) {
      throw createServiceError("Trip not found", 404);
    }

    const passengerRows = await db
      .select({
        fullName: passenger.fullName,
        email: passenger.email,
        phone: passenger.phone,
        carriesLuggage: passenger.carriesLuggage,
      })
      .from(passenger)
      .innerJoin(booking, eq(passenger.bookingId, booking.id))
      .where(
        and(
          eq(booking.tripId, tripId),
          inArray(booking.status, [...VISIBLE_BOOKING_STATUSES]),
          notInArray(booking.paymentStatus, HIDDEN_BOOKING_PAYMENT_STATUSES),
        ),
      );

    const earningRecord = await db.query.earning.findFirst({
      where: eq(earning.tripId, tripId),
    });

    const tripRow = tripRecord.trip;
    const routeRow = tripRecord.route;

    return {
      trip: {
        id: tripRow.id,
        date: tripRow.date,
        status: tripRow.status,
        departureTime: tripRow.departureTime,
        arrivalTime: tripRow.arrivalTime,
        bookedSeats: tripRow.bookedSeats,
        capacity: tripRow.capacity,
        origin_label: routeRow.origin_label,
        origin_title: routeRow.origin_title,
        destination_title: routeRow.destination_title,
        train_station_title: routeRow.train_station_title,
        pickup_point: routeRow.pickup_point,
        dropoff_point: routeRow.dropoff_point,
        price: routeRow.price,
      },
      passengers: passengerRows,
      earning: earningRecord
        ? {
            amount: earningRecord.amount,
            currency: earningRecord.currency,
            status: earningRecord.status,
            driverId: earningRecord.driverId,
          }
        : null,
    };
  }
}

export const bookingService = new BookingService(routeRepository);
