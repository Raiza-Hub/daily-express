// shared typescript types
import { z } from "zod";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  emailVerified: boolean;
  referal: string;
  createdAt: Date;
  updatedAt: Date;
  hasPassword?: boolean;
}

export interface GetMeResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface UpdateUserRequest {
  firstName?: string;
  lastName?: string;
  dateOfBirth?: Date;
}

export interface Driver {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  profile_pic?: string | null;
  phone: string;
  address: string;
  country: string;
  currency: string;
  state: string;
  city: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankVerificationStatus: BankVerificationStatus;
  bankVerificationFailureReason?: string | null;
  bankVerificationRequestedAt?: Date | null;
  bankVerifiedAt?: Date | null;
  isActive?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type BankVerificationStatus = "pending" | "active" | "failed";

export interface DriverPublicProfile {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  profile_pic?: string | null;
  country: string;
  state: string;
}

export interface DriverStats {
  id: string;
  driverId: string;
  totalEarnings: number;
  pendingPayments: number;
  totalPassengers: number;
  activeRoutes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  email?: string;
  profile_pic?: string;
  phone?: string;
  country?: string;
  currency?: string;
  state?: string;
  city?: string;
  address?: string;
  bankName?: string;
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
}

export interface ServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JWTPayload {
  userId: string;
  email: string;
  emailVerified: boolean;
  role?: string;
  iat?: number;
  exp?: number;
}

export class ServiceError extends Error {
  statusCode: number;
  code?: string;
  details?: any;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    details?: any,
  ) {
    super(message);
    this.name = "ServiceError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function logError(error: Error, context?: Record<string, any>): void {
  console.error("Error occured", {
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });
}

export interface Route {
  id: string;
  driverId: string;
  pickup_location_title: string;
  pickup_location_locality: string;
  pickup_location_label: string;
  dropoff_location_title: string;
  dropoff_location_locality: string;
  dropoff_location_label: string;
  intermediate_stops_title: string | null;
  intermediate_stops_locality: string | null;
  intermediate_stops_label: string | null;
  vehicleType: "car" | "bus" | "luxury_car";
  meeting_point: string;
  availableSeats: number;
  remainingSeats: number;
  price: number;
  departure_time: Date;
  arrival_time: Date;
  status: "inactive" | "pending" | "active";
  createdAt: Date;
  updatedAt: Date;
  driver: {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
    profile_pic: string | null;
    country: string;
    state: string;
  };
}
export interface CreateRoute {
  driverId?: string;
  pickup_location_title: string;
  pickup_location_locality: string;
  pickup_location_label: string;
  dropoff_location_title: string;
  dropoff_location_locality: string;
  dropoff_location_label: string;
  intermediate_stops_title: string | null;
  intermediate_stops_locality: string | null;
  intermediate_stops_label: string | null;
  vehicleType: "car" | "bus" | "luxury_car";
  meeting_point: string;
  availableSeats: number;
  price: number;
  departure_time: Date;
  arrival_time: Date;
  status: "inactive" | "pending" | "active";
}

export interface updateRouteRequest {
  pickup_location_title?: string;
  pickup_location_locality?: string;
  pickup_location_label?: string;
  dropoff_location_title?: string;
  dropoff_location_locality?: string;
  dropoff_location_label?: string;
  intermediate_stops_title?: string | null;
  intermediate_stops_locality?: string | null;
  intermediate_stops_label?: string | null;
  vehicleType?: "car" | "bus" | "luxury_car";
  meeting_point?: string;
  availableSeats?: number;
  price?: number;
  departure_time?: Date;
  arrival_time?: Date;
  status?: "inactive" | "pending" | "active";
}

export interface CreateTrip {
  routeId: string;
  date: string;
  driverId?: string;
  capacity?: number;
  bookedSeats?: number;
  status?:
    | "pending"
    | "confirmed"
    | "cancelled"
    | "completed"
    | "booking_closed";
}

export interface Trip {
  id: string;
  routeId: string;
  driverId: string;
  date: Date;
  capacity: number;
  bookedSeats: number;
  status:
    | "pending"
    | "confirmed"
    | "cancelled"
    | "completed"
    | "booking_closed";
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverTripDetails extends Trip {
  route: Route;
  earnings: number;
}

export interface TripsSummary {
  date: string;
  totalEarnings: number;
  totalTrips: number;
  totalPassengers: number;
  totalRoutes: number;
  trips: DriverTripDetails[];
}

export interface Booking {
  id: string;
  tripId: string;
  userId: string;
  seatNumber: number | null;
  status:
    | "pending"
    | "confirmed"
    | "cancelled"
    | "completed"
    | "booking_closed";
  expiresAt?: Date | null;
  paymentReference?: string | null;
  paymentStatus?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserBookingDetails extends Booking {
  trip: DriverTripDetails;
  driver?: Route["driver"] | null;
}

export interface CreateBooking {
  routeId: string;
  tripDate: string;
}

export interface updateBookingRequest {
  tripId?: string;
  userId?: string;
  seatNumber?: number;
  status?: "pending" | "confirmed" | "cancelled" | "completed";
  paymentReference?: string;
  paymentStatus?: string;
}

export type PaymentStatus =
  | "initialized"
  | "pending"
  | "successful"
  | "failed"
  | "cancelled"
  | "expired"
  | "refund_pending"
  | "refunded"
  | "refund_failed";

export const KORA_CHECKOUT_CHANNELS = [
  "bank_transfer",
  "card",
  "pay_with_bank",
  "mobile_money",
] as const;

export type KoraCheckoutChannel = (typeof KORA_CHECKOUT_CHANNELS)[number];

export interface Payment {
  id: string;
  userId: string;
  bookingId?: string | null;
  provider: "kora";
  reference: string;
  providerTransactionId?: string | null;
  amount: number;
  currency: string;
  productName: string;
  productDescription: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerMobile?: string | null;
  status: PaymentStatus;
  providerStatus?: string | null;
  checkoutUrl?: string | null;
  checkoutToken?: string | null;
  redirectUrl: string;
  cancelUrl?: string | null;
  channels?: KoraCheckoutChannel[] | null;
  rawInitializeResponse?: unknown;
  rawVerificationResponse?: unknown;
  metadata?: Record<string, unknown> | null;
  lastStatusCheckAt?: Date | null;
  paidAt?: Date | null;
  failedAt?: Date | null;
  failureCode?: string | null;
  failureReason?: string | null;
  expiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTripCheckoutRequest {
  routeId: string;
  tripDate: string;
  channels?: KoraCheckoutChannel[];
  productName: string;
  productDescription: string;
  customerName?: string;
  customerMobile?: string;
  metadata?: Record<string, unknown>;
}

export interface TripCheckout {
  bookingId: string;
  paymentReference: string;
  checkoutUrl?: string | null;
  expiresAt?: Date | string | null;
}

export type EarningStatus =
  | "pending_trip_completion"
  | "available"
  | "reserved"
  | "processing"
  | "paid"
  | "cancelled"
  | "manual_review";

export type PayoutStatus =
  | "processing"
  | "success"
  | "failed"
  | "permanent_failed";

export type NotificationTone = "critical" | "attention" | "positive" | "info";

export type DriverNotificationKind = "event" | "state";

export interface DriverNotification {
  id: string;
  driverId: string;
  notificationKey: string;
  kind: DriverNotificationKind;
  type: string;
  title: string;
  message: string;
  href?: string | null;
  tag: string;
  tone: NotificationTone;
  metadata?: Record<string, unknown> | null;
  readAt?: Date | string | null;
  occurredAt: Date | string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export const DRIVER_NOTIFICATION_REALTIME_VERSION = 1;

export interface DriverNotificationCreatedRealtimeEvent {
  version: typeof DRIVER_NOTIFICATION_REALTIME_VERSION;
  type: "notification.created";
  payload: DriverNotification;
  timestamp: number;
}

export interface DriverNotificationReadRealtimeEvent {
  version: typeof DRIVER_NOTIFICATION_REALTIME_VERSION;
  type: "notification.read";
  payload: {
    id: string;
  };
  timestamp: number;
}

export interface DriverNotificationReadAllRealtimeEvent {
  version: typeof DRIVER_NOTIFICATION_REALTIME_VERSION;
  type: "notification.read_all";
  payload: Record<string, never>;
  timestamp: number;
}

export type DriverNotificationRealtimeEvent =
  | DriverNotificationCreatedRealtimeEvent
  | DriverNotificationReadRealtimeEvent
  | DriverNotificationReadAllRealtimeEvent;

export interface DriverNotificationRealtimeEvents {
  notification: {
    created: DriverNotificationCreatedRealtimeEvent;
    read: DriverNotificationReadRealtimeEvent;
    read_all: DriverNotificationReadAllRealtimeEvent;
  };
}

export interface DriverPayoutBalance {
  pendingAmountMinor: number;
  availableAmountMinor: number;
  processingAmountMinor: number;
  paidAmountMinor: number;
  nextAutoPayoutAt: string | null;
}

export interface DriverPendingPayoutTrip {
  tripId: string;
  routeId: string;
  tripDate: string;
  pickupTitle: string;
  dropoffTitle: string;
  pendingAmountMinor: number;
  currency: string;
}

export interface DriverPayout {
  id: string;
  driverId: string;
  reference: string;
  amountMinor: number;
  koraFeeAmount?: number | null;
  currency: string;
  earningsCount: number;
  status: PayoutStatus;
  failureCode?: string | null;
  failureReason?: string | null;
  nextRetryAt?: Date | null;
  initiatedAt?: Date | null;
  settledAt?: Date | null;
  failedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DriverPayoutHistoryItem extends DriverPayout {
  recipientId?: string | null;
}

export interface DriverPayoutSummaryDay {
  date: string;
  totalPaidAmountMinor: number;
  payoutsCount: number;
}

export interface DriverPayoutSummary {
  weekStart: string;
  currency: string;
  days: DriverPayoutSummaryDay[];
}

export interface ResolveBankAccountRequest {
  bankCode: string;
  accountNumber: string;
  currency: string;
}

export interface ResolveBankAccountResponse {
  accountName: string;
  bankName: string;
  bankCode: string;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushNotificationPayload {
  title: string;
  message: string;
  tag?: string;
  href?: string;
  tone?: NotificationTone;
  ttl?: number;
  urgency?: "low" | "normal" | "high";
}

export const driverNotificationSchema = z.object({
  id: z.string(),
  driverId: z.string(),
  notificationKey: z.string(),
  kind: z.enum(["event", "state"]),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  href: z.string().nullable().optional(),
  tag: z.string(),
  tone: z.enum(["critical", "attention", "positive", "info"]),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  readAt: z.union([z.string(), z.date()]).nullable().optional(),
  occurredAt: z.union([z.string(), z.date()]),
  createdAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]),
});

export const driverNotificationRealtimeEnvelopeSchema = z.object({
  version: z.literal(DRIVER_NOTIFICATION_REALTIME_VERSION),
  timestamp: z.number().int(),
});

export const driverNotificationCreatedRealtimeEventSchema = z.object({
  ...driverNotificationRealtimeEnvelopeSchema.shape,
  type: z.literal("notification.created"),
  payload: driverNotificationSchema,
});

export const driverNotificationReadRealtimeEventSchema = z.object({
  ...driverNotificationRealtimeEnvelopeSchema.shape,
  type: z.literal("notification.read"),
  payload: z.object({ id: z.string() }),
});

export const driverNotificationReadAllRealtimeEventSchema = z.object({
  ...driverNotificationRealtimeEnvelopeSchema.shape,
  type: z.literal("notification.read_all"),
  payload: z.object({}),
});
