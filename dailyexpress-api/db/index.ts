import { adminSchema } from "./admin-schema";
import { authSchema } from "./auth-schema";
import { driverSchema, driverRelations, driverStatsRelations } from "./driver-schema";
import { notification } from "./notification-schema";
import { paymentSchema } from "./payment-schema";
import { payoutSchema } from "./payout-schema";
import { routeSchema, routeRelations, tripRelations, bookingRelations, vehicleRelations, externalDriverRelations } from "./route-schema";
import { zoneSchema, zoneRelations } from "./zone-schema";

export const schema = {
  ...adminSchema,
  ...authSchema,
  ...driverSchema,
  notification,
  ...paymentSchema,
  ...payoutSchema,
  ...routeSchema,
  ...zoneSchema,
  routeRelations,
  tripRelations,
  bookingRelations,
  vehicleRelations,
  externalDriverRelations,
  zoneRelations,
  driverRelations,
  driverStatsRelations,
};

export * from "./admin-schema";
export * from "./auth-schema";
export * from "./driver-schema";
export * from "./notification-schema";
export * from "./payment-schema";
export * from "./payout-schema";
export * from "./route-schema";
export * from "./zone-schema";

export type { PaymentRecord, RefundRecord, PaymentWebhookRecord } from "./payment-schema";
export type { BookingRecord, TripRecord, RouteRecord, VehicleRecord, ExternalDriverRecord } from "./route-schema";
export type { EarningRecord, PayoutRecord, PayoutAttemptRecord, PayoutRecipientRecord } from "./payout-schema";
export type { DriverRecord, DriverStatsRecord } from "./driver-schema";
export type { UserRecord, OtpRecord, UserProviderRecord, PasswordResetTokenRecord } from "./auth-schema";
export type { NotificationRecord } from "./notification-schema";
export type { AdminAuditLogRecord } from "./admin-schema";
export type { ZoneRecord } from "./zone-schema";
