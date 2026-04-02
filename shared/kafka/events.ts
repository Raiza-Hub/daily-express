export interface DomainEvent<TEventType extends string, TPayload> {
  eventId: string;
  eventType: TEventType;
  eventVersion: number;
  occurredAt: string;
  source: string;
  payload: TPayload;
}

export interface NotificationEmailPayload {
  to: string;
  subject: string;
  html: string;
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
  bookingId: string;
  paymentReference: string;
  paymentStatus: "successful";
}

export interface PaymentFailedPayload {
  paymentId: string;
  bookingId: string;
  paymentReference: string;
  paymentStatus: "failed" | "cancelled" | "expired";
  failureReason: string | null;
}

export const USER_ACCOUNT_DELETED_EVENT_TYPE = "user.account.deleted";
export const USER_ACCOUNT_DELETED_SUBJECT = "user.account.deleted-value";

export type UserAccountDeletedEvent = DomainEvent<
  typeof USER_ACCOUNT_DELETED_EVENT_TYPE,
  UserAccountDeletedPayload
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
          { name: "html", type: "string" },
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
          { name: "bookingId", type: "string" },
          { name: "paymentReference", type: "string" },
          { name: "paymentStatus", type: "string" },
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
          { name: "bookingId", type: "string" },
          { name: "paymentReference", type: "string" },
          { name: "paymentStatus", type: "string" },
          { name: "failureReason", type: ["null", "string"], default: null },
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
  [PAYMENT_COMPLETED_EVENT_TYPE]: {
    subject: PAYMENT_COMPLETED_SUBJECT,
    schema: paymentCompletedSchema,
  },
  [PAYMENT_FAILED_EVENT_TYPE]: {
    subject: PAYMENT_FAILED_SUBJECT,
    schema: paymentFailedSchema,
  },
} as const;

export type SupportedEventType = keyof typeof EVENT_SCHEMAS;

export interface EventByType {
  [NOTIFICATION_EMAIL_EVENT_TYPE]: NotificationEmailRequestedEvent;
  [USER_ACCOUNT_DELETED_EVENT_TYPE]: UserAccountDeletedEvent;
  [PAYMENT_COMPLETED_EVENT_TYPE]: PaymentCompletedEvent;
  [PAYMENT_FAILED_EVENT_TYPE]: PaymentFailedEvent;
}

export function createNotificationEmailEvent(input: {
  eventId: string;
  source: string;
  to: string;
  subject: string;
  html: string;
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
      html: input.html,
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

export function createPaymentCompletedEvent(input: {
  eventId: string;
  source: string;
  paymentId: string;
  bookingId: string;
  paymentReference: string;
}): PaymentCompletedEvent {
  return {
    eventId: input.eventId,
    eventType: PAYMENT_COMPLETED_EVENT_TYPE,
    eventVersion: 1,
    occurredAt: new Date().toISOString(),
    source: input.source,
    payload: {
      paymentId: input.paymentId,
      bookingId: input.bookingId,
      paymentReference: input.paymentReference,
      paymentStatus: "successful",
    },
  };
}

export function createPaymentFailedEvent(input: {
  eventId: string;
  source: string;
  paymentId: string;
  bookingId: string;
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
      bookingId: input.bookingId,
      paymentReference: input.paymentReference,
      paymentStatus: input.paymentStatus,
      failureReason: input.failureReason || null,
    },
  };
}
