import { adminSchema } from "./admin-schema";
import { authSchema } from "./auth-schema";
import { driverSchema } from "./driver-schema";
import { notification } from "./notification-schema";
import { paymentSchema } from "./payment-schema";
import { payoutSchema } from "./payout-schema";
import { routeSchema } from "./route-schema";

export const schema = {
  ...adminSchema,
  ...authSchema,
  ...driverSchema,
  notification,
  ...paymentSchema,
  ...payoutSchema,
  ...routeSchema,
};

export * from "./admin-schema";
export * from "./auth-schema";
export * from "./driver-schema";
export * from "./notification-schema";
export * from "./payment-schema";
export * from "./payout-schema";
export * from "./route-schema";

export type { PaymentRecord, RefundRecord, PaymentWebhookRecord } from "./payment-schema";
export type { BookingRecord, TripRecord, RouteRecord, VehicleRecord, ExternalDriverRecord } from "./route-schema";
export type { EarningRecord, PayoutRecord, PayoutAttemptRecord, PayoutRecipientRecord } from "./payout-schema";
export type { DriverRecord, DriverStatsRecord } from "./driver-schema";
export type { UserRecord, OtpRecord, UserProviderRecord, PasswordResetTokenRecord } from "./auth-schema";
export type { NotificationRecord } from "./notification-schema";
export type { AdminAuditLogRecord } from "./admin-schema";
