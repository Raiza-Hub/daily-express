export interface DomainEvent<TEventType extends string, TPayload> {
  eventId: string;
  eventType: TEventType;
  eventVersion: number;
  occurredAt: string;
  source: string;
  payload: TPayload;
  traceId?: string;
  spanId?: string;
}

export interface NotificationEmailPayload {
  to: string;
  subject: string;
  html?: string | null;
  template?: string | null;
  propsJson?: string | null;
}

export type NotificationEmailRequestedEvent = DomainEvent<
  typeof NOTIFICATION_EMAIL_EVENT_TYPE,
  NotificationEmailPayload
>;

export interface UserAccountDeletedPayload {
  userId: string;
}

export interface PaymentCompletedPayload {
  paymentId: string;
  bookingId?: string | null;
  paymentReference: string;
  paymentStatus: "successful";
  paidAt?: string | null;
  userEmail?: string | null;
}

export interface PaymentFailedPayload {
  paymentId: string;
  bookingId?: string | null;
  paymentReference: string;
  paymentStatus: "failed" | "cancelled" | "expired";
  failureReason: string | null;
}

export interface BookingConfirmedPayload {
  bookingId: string;
  tripId: string;
  routeId: string;
  driverId: string;
  userId: string;
  passengerName: string | null;
  pickupTitle: string;
  dropoffTitle: string;
  seatNumber: number;
  fareAmountMinor: number;
  currency: string;
  paymentReference: string;
  tripDate: string;
  departureTime: string;
}

export interface BookingCancelledPayload {
  bookingId: string;
  tripId: string;
  routeId: string;
  driverId: string;
  paymentReference: string | null;
  cancelledAt: string;
}

export interface TripCompletedPayload {
  tripId: string;
  driverId: string;
  pickupTitle: string;
  dropoffTitle: string;
  tripDate: string;
  completedAt: string;
}

export interface TripCancelledPayload {
  tripId: string;
  driverId: string;
  cancelledAt: string;
}

export interface PayoutCompletedPayload {
  payoutId: string;
  driverId: string;
  reference: string;
  amountMinor: number;
  currency: string;
}

export interface PayoutFailedPayload {
  payoutId: string;
  driverId: string;
  driverEmail: string;
  driverName: string | null;
  reference: string;
  amountMinor: number;
  koraFeeAmount: number;
  currency: string;
  failureReason: string | null;
  bankName: string;
  accountLast4: string;
}

export interface DriverBankVerificationRequestedPayload {
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
}

export interface DriverBankVerifiedPayload {
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
}

export interface DriverBankVerificationFailedPayload {
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  reason: string | null;
  currency: string;
}

export interface DriverIdentityCreatedPayload {
  driverId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  currency: string;
  isActive: boolean;
  profilePictureUrl?: string | null;
}

export interface DriverIdentityUpdatedPayload extends DriverIdentityCreatedPayload {}

export interface DriverIdentityDeletedPayload {
  driverId: string;
  userId: string;
}

export interface DriverPayoutProfileUpsertedPayload {
  driverId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  currency: string;
  isActive: boolean;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankVerificationStatus: "pending" | "active" | "failed";
  bankVerificationFailureReason: string | null;
  updatedAt: string;
}

export interface DriverPayoutProfileDeletedPayload {
  driverId: string;
  userId: string;
  deletedAt: string;
}

export interface UserIdentityUpsertedPayload {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export const USER_ACCOUNT_DELETED_EVENT_TYPE = "user.account.deleted";
export const USER_ACCOUNT_DELETED_SUBJECT = "user.account.deleted-value";

export type UserAccountDeletedEvent = DomainEvent<
  typeof USER_ACCOUNT_DELETED_EVENT_TYPE,
  UserAccountDeletedPayload
>;

export const USER_ACCOUNT_CREATED_EVENT_TYPE = "user.account.created";
export const USER_ACCOUNT_CREATED_SUBJECT = "user.account.created-value";

export interface UserAccountCreatedPayload {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export type UserAccountCreatedEvent = DomainEvent<
  typeof USER_ACCOUNT_CREATED_EVENT_TYPE,
  UserAccountCreatedPayload
>;

export const PAYMENT_COMPLETED_EVENT_TYPE = "payment.completed";
export const PAYMENT_COMPLETED_SUBJECT = "payment.completed-value";

export type PaymentCompletedEvent = DomainEvent<
  typeof PAYMENT_COMPLETED_EVENT_TYPE,
  PaymentCompletedPayload
>;

export const PAYMENT_FAILED_EVENT_TYPE = "payment.failed";
export const PAYMENT_FAILED_SUBJECT = "payment.failed-value";

export type PaymentFailedEvent = DomainEvent<
  typeof PAYMENT_FAILED_EVENT_TYPE,
  PaymentFailedPayload
>;

export const BOOKING_CONFIRMED_EVENT_TYPE = "booking.confirmed";
export const BOOKING_CONFIRMED_SUBJECT = "booking.confirmed-value";

export type BookingConfirmedEvent = DomainEvent<
  typeof BOOKING_CONFIRMED_EVENT_TYPE,
  BookingConfirmedPayload
>;

export const BOOKING_CANCELLED_EVENT_TYPE = "booking.cancelled";
export const BOOKING_CANCELLED_SUBJECT = "booking.cancelled-value";

export type BookingCancelledEvent = DomainEvent<
  typeof BOOKING_CANCELLED_EVENT_TYPE,
  BookingCancelledPayload
>;

export interface BookingCreatedPayload {
  bookingId: string;
  tripId: string;
  userId: string;
  fareAmount: number;
  currency: string;
  expiresAt: string;
}

export const BOOKING_CREATED_EVENT_TYPE = "booking.created";
export const BOOKING_CREATED_SUBJECT = "booking.created-value";

export type BookingCreatedEvent = DomainEvent<
  typeof BOOKING_CREATED_EVENT_TYPE,
  BookingCreatedPayload
>;

export interface RouteCreatedPayload {
  routeId: string;
  driverId: string;
  origin: string;
  destination: string;
  departureTime: string;
}

export interface RouteDeletedPayload {
  routeId: string;
  driverId: string;
}

export const ROUTE_CREATED_EVENT_TYPE = "route.created";
export const ROUTE_CREATED_SUBJECT = "route.created-value";

export type RouteCreatedEvent = DomainEvent<
  typeof ROUTE_CREATED_EVENT_TYPE,
  RouteCreatedPayload
>;

export const ROUTE_DELETED_EVENT_TYPE = "route.deleted";
export const ROUTE_DELETED_SUBJECT = "route.deleted-value";

export type RouteDeletedEvent = DomainEvent<
  typeof ROUTE_DELETED_EVENT_TYPE,
  RouteDeletedPayload
>;

export interface PaymentRefundPayload {
  bookingId: string;
  tripId: string;
  paymentReference: string;
  reason: string | null;
}

export const PAYMENT_REFUND_EVENT_TYPE = "payment.refund";
export const PAYMENT_REFUND_SUBJECT = "payment.refund-value";

export type PaymentRefundEvent = DomainEvent<
  typeof PAYMENT_REFUND_EVENT_TYPE,
  PaymentRefundPayload
>;

export const TRIP_COMPLETED_EVENT_TYPE = "trip.completed";
export const TRIP_COMPLETED_SUBJECT = "trip.completed-value";

export type TripCompletedEvent = DomainEvent<
  typeof TRIP_COMPLETED_EVENT_TYPE,
  TripCompletedPayload
>;

export const TRIP_CANCELLED_EVENT_TYPE = "trip.cancelled";
export const TRIP_CANCELLED_SUBJECT = "trip.cancelled-value";

export type TripCancelledEvent = DomainEvent<
  typeof TRIP_CANCELLED_EVENT_TYPE,
  TripCancelledPayload
>;

export const PAYOUT_COMPLETED_EVENT_TYPE = "payout.completed";
export const PAYOUT_COMPLETED_SUBJECT = "payout.completed-value";

export type PayoutCompletedEvent = DomainEvent<
  typeof PAYOUT_COMPLETED_EVENT_TYPE,
  PayoutCompletedPayload
>;

export const PAYOUT_FAILED_EVENT_TYPE = "payout.failed";
export const PAYOUT_FAILED_SUBJECT = "payout.failed-value";

export type PayoutFailedEvent = DomainEvent<
  typeof PAYOUT_FAILED_EVENT_TYPE,
  PayoutFailedPayload
>;

export const DRIVER_BANK_VERIFICATION_REQUESTED_EVENT_TYPE =
  "driver.bank.verification.requested";
export const DRIVER_BANK_VERIFICATION_REQUESTED_SUBJECT =
  "driver.bank.verification.requested-value";

export type DriverBankVerificationRequestedEvent = DomainEvent<
  typeof DRIVER_BANK_VERIFICATION_REQUESTED_EVENT_TYPE,
  DriverBankVerificationRequestedPayload
>;

export const DRIVER_BANK_VERIFIED_EVENT_TYPE = "driver.bank.verified";
export const DRIVER_BANK_VERIFIED_SUBJECT = "driver.bank.verified-value";

export type DriverBankVerifiedEvent = DomainEvent<
  typeof DRIVER_BANK_VERIFIED_EVENT_TYPE,
  DriverBankVerifiedPayload
>;

export const DRIVER_BANK_VERIFICATION_FAILED_EVENT_TYPE =
  "driver.bank.verification.failed";
export const DRIVER_BANK_VERIFICATION_FAILED_SUBJECT =
  "driver.bank.verification.failed-value";

export type DriverBankVerificationFailedEvent = DomainEvent<
  typeof DRIVER_BANK_VERIFICATION_FAILED_EVENT_TYPE,
  DriverBankVerificationFailedPayload
>;

export const DRIVER_IDENTITY_CREATED_EVENT_TYPE = "driver.identity.created";
export const DRIVER_IDENTITY_CREATED_SUBJECT = "driver.identity.created-value";

export type DriverIdentityCreatedEvent = DomainEvent<
  typeof DRIVER_IDENTITY_CREATED_EVENT_TYPE,
  DriverIdentityCreatedPayload
>;

export const DRIVER_IDENTITY_UPDATED_EVENT_TYPE = "driver.identity.updated";
export const DRIVER_IDENTITY_UPDATED_SUBJECT = "driver.identity.updated-value";

export type DriverIdentityUpdatedEvent = DomainEvent<
  typeof DRIVER_IDENTITY_UPDATED_EVENT_TYPE,
  DriverIdentityUpdatedPayload
>;

export const DRIVER_IDENTITY_DELETED_EVENT_TYPE = "driver.identity.deleted";
export const DRIVER_IDENTITY_DELETED_SUBJECT = "driver.identity.deleted-value";

export type DriverIdentityDeletedEvent = DomainEvent<
  typeof DRIVER_IDENTITY_DELETED_EVENT_TYPE,
  DriverIdentityDeletedPayload
>;

export const DRIVER_PAYOUT_PROFILE_UPSERTED_EVENT_TYPE =
  "driver.payout_profile.upserted";
export const DRIVER_PAYOUT_PROFILE_UPSERTED_SUBJECT =
  "driver.payout_profile.upserted-value";

export type DriverPayoutProfileUpsertedEvent = DomainEvent<
  typeof DRIVER_PAYOUT_PROFILE_UPSERTED_EVENT_TYPE,
  DriverPayoutProfileUpsertedPayload
>;

export const DRIVER_PAYOUT_PROFILE_DELETED_EVENT_TYPE =
  "driver.payout_profile.deleted";
export const DRIVER_PAYOUT_PROFILE_DELETED_SUBJECT =
  "driver.payout_profile.deleted-value";

export type DriverPayoutProfileDeletedEvent = DomainEvent<
  typeof DRIVER_PAYOUT_PROFILE_DELETED_EVENT_TYPE,
  DriverPayoutProfileDeletedPayload
>;

export const USER_IDENTITY_UPSERTED_EVENT_TYPE = "user.identity.upserted";
export const USER_IDENTITY_UPSERTED_SUBJECT = "user.identity.upserted-value";

export type UserIdentityUpsertedEvent = DomainEvent<
  typeof USER_IDENTITY_UPSERTED_EVENT_TYPE,
  UserIdentityUpsertedPayload
>;

export const NOTIFICATION_EMAIL_EVENT_TYPE = "notification.email.send";
export const NOTIFICATION_EMAIL_SUBJECT = "notification.email.send-value";

const notificationEmailSchema = {
  type: "record",
  name: "NotificationEmailRequestedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "NotificationEmailPayloadV1",
        fields: [
          { name: "to", type: "string" },
          { name: "subject", type: "string" },
          { name: "html", type: ["null", "string"], default: null },
          { name: "template", type: ["null", "string"], default: null },
          { name: "propsJson", type: ["null", "string"], default: null },
        ],
      },
    },
  ],
} as const;

const userAccountDeletedSchema = {
  type: "record",
  name: "UserAccountDeletedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "UserAccountDeletedPayloadV1",
        fields: [{ name: "userId", type: "string" }],
      },
    },
  ],
} as const;

const userAccountCreatedSchema = {
  type: "record",
  name: "UserAccountCreatedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "UserAccountCreatedPayloadV1",
        fields: [
          { name: "userId", type: "string" },
          { name: "email", type: "string" },
          { name: "firstName", type: "string" },
          { name: "lastName", type: "string" },
        ],
      },
    },
  ],
} as const;

const paymentCompletedSchema = {
  type: "record",
  name: "PaymentCompletedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "PaymentCompletedPayloadV1",
        fields: [
          { name: "paymentId", type: "string" },
          { name: "bookingId", type: ["null", "string"], default: null },
          { name: "paymentReference", type: "string" },
          { name: "paymentStatus", type: "string" },
          { name: "paidAt", type: ["null", "string"], default: null },
          { name: "userEmail", type: ["null", "string"], default: null },
        ],
      },
    },
  ],
} as const;

const paymentFailedSchema = {
  type: "record",
  name: "PaymentFailedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "PaymentFailedPayloadV1",
        fields: [
          { name: "paymentId", type: "string" },
          { name: "bookingId", type: ["null", "string"], default: null },
          { name: "paymentReference", type: "string" },
          { name: "paymentStatus", type: "string" },
          { name: "failureReason", type: ["null", "string"], default: null },
        ],
      },
    },
  ],
} as const;

const bookingConfirmedSchema = {
  type: "record",
  name: "BookingConfirmedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "BookingConfirmedPayloadV1",
        fields: [
          { name: "bookingId", type: "string" },
          { name: "tripId", type: "string" },
          { name: "routeId", type: "string" },
          { name: "driverId", type: "string" },
          { name: "userId", type: "string" },
          { name: "passengerName", type: ["null", "string"], default: null },
          { name: "pickupTitle", type: "string", default: "" },
          { name: "dropoffTitle", type: "string", default: "" },
          { name: "seatNumber", type: "int" },
          { name: "fareAmountMinor", type: "int" },
          { name: "currency", type: "string" },
          { name: "paymentReference", type: "string" },
          { name: "tripDate", type: "string" },
          { name: "departureTime", type: "string" },
        ],
      },
    },
  ],
} as const;

const bookingCancelledSchema = {
  type: "record",
  name: "BookingCancelledV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "BookingCancelledPayloadV1",
        fields: [
          { name: "bookingId", type: "string" },
          { name: "tripId", type: "string" },
          { name: "routeId", type: "string" },
          { name: "driverId", type: "string" },
          { name: "paymentReference", type: ["null", "string"], default: null },
          { name: "cancelledAt", type: "string" },
        ],
      },
    },
  ],
} as const;

const tripCompletedSchema = {
  type: "record",
  name: "TripCompletedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "TripCompletedPayloadV1",
        fields: [
          { name: "tripId", type: "string" },
          { name: "driverId", type: "string" },
          { name: "pickupTitle", type: "string", default: "" },
          { name: "dropoffTitle", type: "string", default: "" },
          { name: "tripDate", type: "string", default: "" },
          { name: "completedAt", type: "string" },
        ],
      },
    },
  ],
} as const;

const tripCancelledSchema = {
  type: "record",
  name: "TripCancelledV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "TripCancelledPayloadV1",
        fields: [
          { name: "tripId", type: "string" },
          { name: "driverId", type: "string" },
          { name: "cancelledAt", type: "string" },
        ],
      },
    },
  ],
} as const;

const payoutCompletedSchema = {
  type: "record",
  name: "PayoutCompletedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "PayoutCompletedPayloadV1",
        fields: [
          { name: "payoutId", type: "string" },
          { name: "driverId", type: "string" },
          { name: "reference", type: "string" },
          { name: "amountMinor", type: "int" },
          { name: "currency", type: "string" },
        ],
      },
    },
  ],
} as const;

const payoutFailedSchema = {
  type: "record",
  name: "PayoutFailedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "PayoutFailedPayloadV1",
        fields: [
          { name: "payoutId", type: "string" },
          { name: "driverId", type: "string" },
          { name: "driverEmail", type: "string" },
          { name: "driverName", type: ["null", "string"], default: null },
          { name: "reference", type: "string" },
          { name: "amountMinor", type: "int" },
          { name: "koraFeeAmount", type: "int" },
          { name: "currency", type: "string" },
          { name: "failureReason", type: ["null", "string"], default: null },
          { name: "bankName", type: "string" },
          { name: "accountLast4", type: "string" },
        ],
      },
    },
  ],
} as const;

const driverBankVerificationRequestedSchema = {
  type: "record",
  name: "DriverBankVerificationRequestedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "DriverBankVerificationRequestedPayloadV1",
        fields: [
          { name: "driverId", type: "string" },
          { name: "bankName", type: "string" },
          { name: "bankCode", type: "string" },
          { name: "accountNumber", type: "string" },
          { name: "accountName", type: "string" },
          { name: "currency", type: "string" },
        ],
      },
    },
  ],
} as const;

const driverBankVerifiedSchema = {
  type: "record",
  name: "DriverBankVerifiedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "DriverBankVerifiedPayloadV1",
        fields: [
          { name: "driverId", type: "string" },
          { name: "bankName", type: "string" },
          { name: "bankCode", type: "string" },
          { name: "accountNumber", type: "string" },
          { name: "accountName", type: "string" },
          { name: "currency", type: "string" },
        ],
      },
    },
  ],
} as const;

const driverBankVerificationFailedSchema = {
  type: "record",
  name: "DriverBankVerificationFailedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "DriverBankVerificationFailedPayloadV1",
        fields: [
          { name: "driverId", type: "string" },
          { name: "bankName", type: "string" },
          { name: "bankCode", type: "string" },
          { name: "accountNumber", type: "string" },
          { name: "reason", type: ["null", "string"], default: null },
          { name: "currency", type: "string" },
        ],
      },
    },
  ],
} as const;

const driverIdentityCreatedSchema = {
  type: "record",
  name: "DriverIdentityCreatedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "DriverIdentityCreatedPayloadV1",
        fields: [
          { name: "driverId", type: "string" },
          { name: "userId", type: "string" },
          { name: "firstName", type: "string" },
          { name: "lastName", type: "string" },
          { name: "email", type: "string" },
          { name: "phone", type: "string" },
          { name: "country", type: "string" },
          { name: "state", type: "string" },
          { name: "city", type: "string" },
          { name: "currency", type: "string" },
          { name: "isActive", type: "boolean" },
          {
            name: "profilePictureUrl",
            type: ["null", "string"],
            default: null,
          },
        ],
      },
    },
  ],
} as const;

const driverIdentityUpdatedSchema = {
  type: "record",
  name: "DriverIdentityUpdatedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "DriverIdentityUpdatedPayloadV1",
        fields: [
          { name: "driverId", type: "string" },
          { name: "userId", type: "string" },
          { name: "firstName", type: "string" },
          { name: "lastName", type: "string" },
          { name: "email", type: "string" },
          { name: "phone", type: "string" },
          { name: "country", type: "string" },
          { name: "state", type: "string" },
          { name: "city", type: "string" },
          { name: "currency", type: "string" },
          { name: "isActive", type: "boolean" },
          {
            name: "profilePictureUrl",
            type: ["null", "string"],
            default: null,
          },
        ],
      },
    },
  ],
} as const;

const driverIdentityDeletedSchema = {
  type: "record",
  name: "DriverIdentityDeletedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "DriverIdentityDeletedPayloadV1",
        fields: [
          { name: "driverId", type: "string" },
          { name: "userId", type: "string" },
        ],
      },
    },
  ],
} as const;

const driverPayoutProfileUpsertedSchema = {
  type: "record",
  name: "DriverPayoutProfileUpsertedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "DriverPayoutProfileUpsertedPayloadV1",
        fields: [
          { name: "driverId", type: "string" },
          { name: "userId", type: "string" },
          { name: "email", type: "string" },
          { name: "firstName", type: "string" },
          { name: "lastName", type: "string" },
          { name: "phone", type: "string" },
          { name: "currency", type: "string" },
          { name: "isActive", type: "boolean" },
          { name: "bankName", type: "string" },
          { name: "bankCode", type: "string" },
          { name: "accountNumber", type: "string" },
          { name: "accountName", type: "string" },
          { name: "bankVerificationStatus", type: "string" },
          {
            name: "bankVerificationFailureReason",
            type: ["null", "string"],
            default: null,
          },
          { name: "updatedAt", type: "string" },
        ],
      },
    },
  ],
} as const;

const driverPayoutProfileDeletedSchema = {
  type: "record",
  name: "DriverPayoutProfileDeletedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "DriverPayoutProfileDeletedPayloadV1",
        fields: [
          { name: "driverId", type: "string" },
          { name: "userId", type: "string" },
          { name: "deletedAt", type: "string" },
        ],
      },
    },
  ],
} as const;

const userIdentityUpsertedSchema = {
  type: "record",
  name: "UserIdentityUpsertedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "UserIdentityUpsertedPayloadV1",
        fields: [
          { name: "userId", type: "string" },
          { name: "firstName", type: "string" },
          { name: "lastName", type: "string" },
          { name: "email", type: "string" },
        ],
      },
    },
  ],
} as const;

const bookingCreatedSchema = {
  type: "record",
  name: "BookingCreatedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "BookingCreatedPayloadV1",
        fields: [
          { name: "bookingId", type: "string" },
          { name: "tripId", type: "string" },
          { name: "userId", type: "string" },
          { name: "fareAmount", type: "int" },
          { name: "currency", type: "string" },
          { name: "expiresAt", type: "string" },
        ],
      },
    },
  ],
} as const;

const routeCreatedSchema = {
  type: "record",
  name: "RouteCreatedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "RouteCreatedPayloadV1",
        fields: [
          { name: "routeId", type: "string" },
          { name: "driverId", type: "string" },
          { name: "origin", type: "string" },
          { name: "destination", type: "string" },
          { name: "departureTime", type: "string" },
        ],
      },
    },
  ],
} as const;

const routeDeletedSchema = {
  type: "record",
  name: "RouteDeletedV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "RouteDeletedPayloadV1",
        fields: [
          { name: "routeId", type: "string" },
          { name: "driverId", type: "string" },
        ],
      },
    },
  ],
} as const;

const paymentRefundSchema = {
  type: "record",
  name: "PaymentRefundV1",
  namespace: "com.dailyexpress.events",
  fields: [
    { name: "eventId", type: "string" },
    { name: "eventType", type: "string" },
    { name: "eventVersion", type: "int" },
    { name: "occurredAt", type: "string" },
    { name: "source", type: "string" },
    {
      name: "payload",
      type: {
        type: "record",
        name: "PaymentRefundPayloadV1",
        fields: [
          { name: "bookingId", type: "string" },
          { name: "tripId", type: "string" },
          { name: "paymentReference", type: "string" },
          { name: "reason", type: ["null", "string"], default: null },
        ],
      },
    },
  ],
} as const;

export const EVENT_SCHEMAS = {
  [NOTIFICATION_EMAIL_EVENT_TYPE]: {
    subject: NOTIFICATION_EMAIL_SUBJECT,
    schema: notificationEmailSchema,
  },
  [USER_ACCOUNT_DELETED_EVENT_TYPE]: {
    subject: USER_ACCOUNT_DELETED_SUBJECT,
    schema: userAccountDeletedSchema,
  },
  [USER_ACCOUNT_CREATED_EVENT_TYPE]: {
    subject: USER_ACCOUNT_CREATED_SUBJECT,
    schema: userAccountCreatedSchema,
  },
  [PAYMENT_COMPLETED_EVENT_TYPE]: {
    subject: PAYMENT_COMPLETED_SUBJECT,
    schema: paymentCompletedSchema,
  },
  [PAYMENT_FAILED_EVENT_TYPE]: {
    subject: PAYMENT_FAILED_SUBJECT,
    schema: paymentFailedSchema,
  },
  [BOOKING_CONFIRMED_EVENT_TYPE]: {
    subject: BOOKING_CONFIRMED_SUBJECT,
    schema: bookingConfirmedSchema,
  },
  [BOOKING_CANCELLED_EVENT_TYPE]: {
    subject: BOOKING_CANCELLED_SUBJECT,
    schema: bookingCancelledSchema,
  },
  [TRIP_COMPLETED_EVENT_TYPE]: {
    subject: TRIP_COMPLETED_SUBJECT,
    schema: tripCompletedSchema,
  },
  [TRIP_CANCELLED_EVENT_TYPE]: {
    subject: TRIP_CANCELLED_SUBJECT,
    schema: tripCancelledSchema,
  },
  [PAYOUT_COMPLETED_EVENT_TYPE]: {
    subject: PAYOUT_COMPLETED_SUBJECT,
    schema: payoutCompletedSchema,
  },
  [PAYOUT_FAILED_EVENT_TYPE]: {
    subject: PAYOUT_FAILED_SUBJECT,
    schema: payoutFailedSchema,
  },
  [DRIVER_BANK_VERIFICATION_REQUESTED_EVENT_TYPE]: {
    subject: DRIVER_BANK_VERIFICATION_REQUESTED_SUBJECT,
    schema: driverBankVerificationRequestedSchema,
  },
  [DRIVER_BANK_VERIFIED_EVENT_TYPE]: {
    subject: DRIVER_BANK_VERIFIED_SUBJECT,
    schema: driverBankVerifiedSchema,
  },
  [DRIVER_BANK_VERIFICATION_FAILED_EVENT_TYPE]: {
    subject: DRIVER_BANK_VERIFICATION_FAILED_SUBJECT,
    schema: driverBankVerificationFailedSchema,
  },
  [DRIVER_IDENTITY_CREATED_EVENT_TYPE]: {
    subject: DRIVER_IDENTITY_CREATED_SUBJECT,
    schema: driverIdentityCreatedSchema,
  },
  [DRIVER_IDENTITY_UPDATED_EVENT_TYPE]: {
    subject: DRIVER_IDENTITY_UPDATED_SUBJECT,
    schema: driverIdentityUpdatedSchema,
  },
  [DRIVER_IDENTITY_DELETED_EVENT_TYPE]: {
    subject: DRIVER_IDENTITY_DELETED_SUBJECT,
    schema: driverIdentityDeletedSchema,
  },
  [DRIVER_PAYOUT_PROFILE_UPSERTED_EVENT_TYPE]: {
    subject: DRIVER_PAYOUT_PROFILE_UPSERTED_SUBJECT,
    schema: driverPayoutProfileUpsertedSchema,
  },
  [DRIVER_PAYOUT_PROFILE_DELETED_EVENT_TYPE]: {
    subject: DRIVER_PAYOUT_PROFILE_DELETED_SUBJECT,
    schema: driverPayoutProfileDeletedSchema,
  },
  [USER_IDENTITY_UPSERTED_EVENT_TYPE]: {
    subject: USER_IDENTITY_UPSERTED_SUBJECT,
    schema: userIdentityUpsertedSchema,
  },
  [BOOKING_CREATED_EVENT_TYPE]: {
    subject: BOOKING_CREATED_SUBJECT,
    schema: bookingCreatedSchema,
  },
  [ROUTE_CREATED_EVENT_TYPE]: {
    subject: ROUTE_CREATED_SUBJECT,
    schema: routeCreatedSchema,
  },
  [ROUTE_DELETED_EVENT_TYPE]: {
    subject: ROUTE_DELETED_SUBJECT,
    schema: routeDeletedSchema,
  },
  [PAYMENT_REFUND_EVENT_TYPE]: {
    subject: PAYMENT_REFUND_SUBJECT,
    schema: paymentRefundSchema,
  },
} as const;

export type SupportedEventType = keyof typeof EVENT_SCHEMAS;

export interface EventByType {
  [NOTIFICATION_EMAIL_EVENT_TYPE]: NotificationEmailRequestedEvent;
  [USER_ACCOUNT_DELETED_EVENT_TYPE]: UserAccountDeletedEvent;
  [USER_ACCOUNT_CREATED_EVENT_TYPE]: UserAccountCreatedEvent;
  [PAYMENT_COMPLETED_EVENT_TYPE]: PaymentCompletedEvent;
  [PAYMENT_FAILED_EVENT_TYPE]: PaymentFailedEvent;
  [BOOKING_CONFIRMED_EVENT_TYPE]: BookingConfirmedEvent;
  [BOOKING_CANCELLED_EVENT_TYPE]: BookingCancelledEvent;
  [BOOKING_CREATED_EVENT_TYPE]: BookingCreatedEvent;
  [ROUTE_CREATED_EVENT_TYPE]: RouteCreatedEvent;
  [ROUTE_DELETED_EVENT_TYPE]: RouteDeletedEvent;
  [PAYMENT_REFUND_EVENT_TYPE]: PaymentRefundEvent;

  [TRIP_COMPLETED_EVENT_TYPE]: TripCompletedEvent;
  [TRIP_CANCELLED_EVENT_TYPE]: TripCancelledEvent;
  [PAYOUT_COMPLETED_EVENT_TYPE]: PayoutCompletedEvent;
  [PAYOUT_FAILED_EVENT_TYPE]: PayoutFailedEvent;
  [DRIVER_BANK_VERIFICATION_REQUESTED_EVENT_TYPE]: DriverBankVerificationRequestedEvent;
  [DRIVER_BANK_VERIFIED_EVENT_TYPE]: DriverBankVerifiedEvent;
  [DRIVER_BANK_VERIFICATION_FAILED_EVENT_TYPE]: DriverBankVerificationFailedEvent;
  [DRIVER_IDENTITY_CREATED_EVENT_TYPE]: DriverIdentityCreatedEvent;
  [DRIVER_IDENTITY_UPDATED_EVENT_TYPE]: DriverIdentityUpdatedEvent;
  [DRIVER_IDENTITY_DELETED_EVENT_TYPE]: DriverIdentityDeletedEvent;
  [DRIVER_PAYOUT_PROFILE_UPSERTED_EVENT_TYPE]: DriverPayoutProfileUpsertedEvent;
  [DRIVER_PAYOUT_PROFILE_DELETED_EVENT_TYPE]: DriverPayoutProfileDeletedEvent;
  [USER_IDENTITY_UPSERTED_EVENT_TYPE]: UserIdentityUpsertedEvent;
}

export function createNotificationEmailEvent(input: {
  eventId: string;
  source: string;
  to: string;
  subject: string;
  html?: string;
  template?: string;
  propsJson?: string;
}): NotificationEmailRequestedEvent {
  return {
    eventId: input.eventId,
    eventType: NOTIFICATION_EMAIL_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      to: input.to,
      subject: input.subject,
      html: input.html || null,
      template: input.template || null,
      propsJson: input.propsJson || null,
    },
  };
}

export function createUserAccountDeletedEvent(input: {
  eventId: string;
  source: string;
  userId: string;
}): UserAccountDeletedEvent {
  return {
    eventId: input.eventId,
    eventType: USER_ACCOUNT_DELETED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      userId: input.userId,
    },
  };
}

export function createUserAccountCreatedEvent(input: {
  eventId: string;
  source: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
}): UserAccountCreatedEvent {
  return {
    eventId: input.eventId,
    eventType: USER_ACCOUNT_CREATED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      userId: input.userId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  };
}

export function createPaymentCompletedEvent(input: {
  eventId: string;
  source: string;
  paymentId: string;
  bookingId?: string | null;
  paymentReference: string;
  paidAt?: string | null;
  userEmail?: string;
}): PaymentCompletedEvent {
  return {
    eventId: input.eventId,
    eventType: PAYMENT_COMPLETED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      paymentId: input.paymentId,
      bookingId: input.bookingId ?? null,
      paymentReference: input.paymentReference,
      paymentStatus: "successful",
      paidAt: input.paidAt ?? null,
      userEmail: input.userEmail || null,
    },
  };
}

export function createPaymentFailedEvent(input: {
  eventId: string;
  source: string;
  paymentId: string;
  bookingId?: string | null;
  paymentReference: string;
  paymentStatus: "failed" | "cancelled" | "expired";
  failureReason?: string | null;
}): PaymentFailedEvent {
  return {
    eventId: input.eventId,
    eventType: PAYMENT_FAILED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      paymentId: input.paymentId,
      bookingId: input.bookingId ?? null,
      paymentReference: input.paymentReference,
      paymentStatus: input.paymentStatus,
      failureReason: input.failureReason || null,
    },
  };
}

export function createBookingConfirmedEvent(input: {
  eventId: string;
  source: string;
  bookingId: string;
  tripId: string;
  routeId: string;
  driverId: string;
  userId: string;
  passengerName: string | null;
  pickupTitle: string;
  dropoffTitle: string;
  seatNumber: number;
  fareAmountMinor: number;
  currency: string;
  paymentReference: string;
  tripDate: string;
  departureTime: string;
}): BookingConfirmedEvent {
  return {
    eventId: input.eventId,
    eventType: BOOKING_CONFIRMED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      bookingId: input.bookingId,
      tripId: input.tripId,
      routeId: input.routeId,
      driverId: input.driverId,
      userId: input.userId,
      passengerName: input.passengerName,
      pickupTitle: input.pickupTitle,
      dropoffTitle: input.dropoffTitle,
      seatNumber: input.seatNumber,
      fareAmountMinor: input.fareAmountMinor,
      currency: input.currency,
      paymentReference: input.paymentReference,
      tripDate: input.tripDate,
      departureTime: input.departureTime,
    },
  };
}

export function createBookingCancelledEvent(input: {
  eventId: string;
  source: string;
  bookingId: string;
  tripId: string;
  routeId: string;
  driverId: string;
  paymentReference?: string | null;
  cancelledAt?: string;
}): BookingCancelledEvent {
  return {
    eventId: input.eventId,
    eventType: BOOKING_CANCELLED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      bookingId: input.bookingId,
      tripId: input.tripId,
      routeId: input.routeId,
      driverId: input.driverId,
      paymentReference: input.paymentReference || null,
      cancelledAt: input.cancelledAt || new Date().toISOString(),
    },
  };
}

export function createTripCompletedEvent(input: {
  eventId: string;
  source: string;
  tripId: string;
  driverId: string;
  pickupTitle: string;
  dropoffTitle: string;
  tripDate: string;
  completedAt?: string;
}): TripCompletedEvent {
  return {
    eventId: input.eventId,
    eventType: TRIP_COMPLETED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      tripId: input.tripId,
      driverId: input.driverId,
      pickupTitle: input.pickupTitle,
      dropoffTitle: input.dropoffTitle,
      tripDate: input.tripDate,
      completedAt: input.completedAt || new Date().toISOString(),
    },
  };
}

export function createTripCancelledEvent(input: {
  eventId: string;
  source: string;
  tripId: string;
  driverId: string;
  cancelledAt?: string;
}): TripCancelledEvent {
  return {
    eventId: input.eventId,
    eventType: TRIP_CANCELLED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      tripId: input.tripId,
      driverId: input.driverId,
      cancelledAt: input.cancelledAt || new Date().toISOString(),
    },
  };
}

export function createPayoutCompletedEvent(input: {
  eventId: string;
  source: string;
  payoutId: string;
  driverId: string;
  reference: string;
  amountMinor: number;
  currency: string;
}): PayoutCompletedEvent {
  return {
    eventId: input.eventId,
    eventType: PAYOUT_COMPLETED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      payoutId: input.payoutId,
      driverId: input.driverId,
      reference: input.reference,
      amountMinor: input.amountMinor,
      currency: input.currency,
    },
  };
}

export function createPayoutFailedEvent(input: {
  eventId: string;
  source: string;
  payoutId: string;
  driverId: string;
  driverEmail: string;
  driverName: string | null;
  reference: string;
  amountMinor: number;
  koraFeeAmount: number;
  currency: string;
  failureReason?: string | null;
  bankName: string;
  accountLast4: string;
}): PayoutFailedEvent {
  return {
    eventId: input.eventId,
    eventType: PAYOUT_FAILED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      payoutId: input.payoutId,
      driverId: input.driverId,
      driverEmail: input.driverEmail,
      driverName: input.driverName,
      reference: input.reference,
      amountMinor: input.amountMinor,
      koraFeeAmount: input.koraFeeAmount,
      currency: input.currency,
      failureReason: input.failureReason || null,
      bankName: input.bankName,
      accountLast4: input.accountLast4,
    },
  };
}

export function createDriverBankVerificationRequestedEvent(input: {
  eventId: string;
  source: string;
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
}): DriverBankVerificationRequestedEvent {
  return {
    eventId: input.eventId,
    eventType: DRIVER_BANK_VERIFICATION_REQUESTED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      driverId: input.driverId,
      bankName: input.bankName,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      currency: input.currency,
    },
  };
}

export function createDriverBankVerifiedEvent(input: {
  eventId: string;
  source: string;
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
}): DriverBankVerifiedEvent {
  return {
    eventId: input.eventId,
    eventType: DRIVER_BANK_VERIFIED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      driverId: input.driverId,
      bankName: input.bankName,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      currency: input.currency,
    },
  };
}

export function createDriverBankVerificationFailedEvent(input: {
  eventId: string;
  source: string;
  driverId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  reason?: string | null;
  currency: string;
}): DriverBankVerificationFailedEvent {
  return {
    eventId: input.eventId,
    eventType: DRIVER_BANK_VERIFICATION_FAILED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      driverId: input.driverId,
      bankName: input.bankName,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      reason: input.reason || null,
      currency: input.currency,
    },
  };
}

export function createDriverIdentityCreatedEvent(input: {
  eventId: string;
  source: string;
  driverId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  currency: string;
  isActive: boolean;
  profilePictureUrl?: string | null;
}): DriverIdentityCreatedEvent {
  return {
    eventId: input.eventId,
    eventType: DRIVER_IDENTITY_CREATED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      driverId: input.driverId,
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      state: input.state,
      city: input.city,
      currency: input.currency,
      isActive: input.isActive,
      profilePictureUrl: input.profilePictureUrl ?? null,
    },
  };
}

export function createDriverIdentityUpdatedEvent(input: {
  eventId: string;
  source: string;
  driverId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
  state: string;
  city: string;
  currency: string;
  isActive: boolean;
  profilePictureUrl?: string | null;
}): DriverIdentityUpdatedEvent {
  return {
    eventId: input.eventId,
    eventType: DRIVER_IDENTITY_UPDATED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      driverId: input.driverId,
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      country: input.country,
      state: input.state,
      city: input.city,
      currency: input.currency,
      isActive: input.isActive,
      profilePictureUrl: input.profilePictureUrl ?? null,
    },
  };
}

export function createDriverIdentityDeletedEvent(input: {
  eventId: string;
  source: string;
  driverId: string;
  userId: string;
}): DriverIdentityDeletedEvent {
  return {
    eventId: input.eventId,
    eventType: DRIVER_IDENTITY_DELETED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      driverId: input.driverId,
      userId: input.userId,
    },
  };
}

export function createDriverPayoutProfileUpsertedEvent(input: {
  eventId: string;
  source: string;
  driverId: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  currency: string;
  isActive: boolean;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  bankVerificationStatus: "pending" | "active" | "failed";
  bankVerificationFailureReason?: string | null;
  updatedAt: string;
}): DriverPayoutProfileUpsertedEvent {
  return {
    eventId: input.eventId,
    eventType: DRIVER_PAYOUT_PROFILE_UPSERTED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      driverId: input.driverId,
      userId: input.userId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      currency: input.currency,
      isActive: input.isActive,
      bankName: input.bankName,
      bankCode: input.bankCode,
      accountNumber: input.accountNumber,
      accountName: input.accountName,
      bankVerificationStatus: input.bankVerificationStatus,
      bankVerificationFailureReason:
        input.bankVerificationFailureReason ?? null,
      updatedAt: input.updatedAt,
    },
  };
}

export function createDriverPayoutProfileDeletedEvent(input: {
  eventId: string;
  source: string;
  driverId: string;
  userId: string;
  deletedAt: string;
}): DriverPayoutProfileDeletedEvent {
  return {
    eventId: input.eventId,
    eventType: DRIVER_PAYOUT_PROFILE_DELETED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      driverId: input.driverId,
      userId: input.userId,
      deletedAt: input.deletedAt,
    },
  };
}

export function createUserIdentityUpsertedEvent(input: {
  eventId: string;
  source: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
}): UserIdentityUpsertedEvent {
  return {
    eventId: input.eventId,
    eventType: USER_IDENTITY_UPSERTED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      userId: input.userId,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
    },
  };
}

export function createBookingCreatedEvent(input: {
  eventId: string;
  source: string;
  bookingId: string;
  tripId: string;
  userId: string;
  fareAmount: number;
  currency: string;
  expiresAt: string;
}): BookingCreatedEvent {
  return {
    eventId: input.eventId,
    eventType: BOOKING_CREATED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      bookingId: input.bookingId,
      tripId: input.tripId,
      userId: input.userId,
      fareAmount: input.fareAmount,
      currency: input.currency,
      expiresAt: input.expiresAt,
    },
  };
}

export function createRouteCreatedEvent(input: {
  eventId: string;
  source: string;
  routeId: string;
  driverId: string;
  origin: string;
  destination: string;
  departureTime: string;
}): RouteCreatedEvent {
  return {
    eventId: input.eventId,
    eventType: ROUTE_CREATED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      routeId: input.routeId,
      driverId: input.driverId,
      origin: input.origin,
      destination: input.destination,
      departureTime: input.departureTime,
    },
  };
}

export function createRouteDeletedEvent(input: {
  eventId: string;
  source: string;
  routeId: string;
  driverId: string;
}): RouteDeletedEvent {
  return {
    eventId: input.eventId,
    eventType: ROUTE_DELETED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      routeId: input.routeId,
      driverId: input.driverId,
    },
  };
}

export function createPaymentRefundEvent(input: {
  eventId: string;
  source: string;
  bookingId: string;
  tripId: string;
  paymentReference: string;
  reason?: string | null;
}): PaymentRefundEvent {
  return {
    eventId: input.eventId,
    eventType: PAYMENT_REFUND_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      bookingId: input.bookingId,
      tripId: input.tripId,
      paymentReference: input.paymentReference,
      reason: input.reason || null,
    },
  };
}
