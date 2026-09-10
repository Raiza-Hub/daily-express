import { adminSchema } from "./admin-schema";
import { authSchema } from "./auth-schema";
import { driverSchema } from "./driver-schema";
import { paymentSchema } from "./payment-schema";
import { payoutSchema } from "./payout-schema";
import { routeSchema } from "./route-schema";

export const schema = {
  ...adminSchema,
  ...authSchema,
  ...driverSchema,
  ...paymentSchema,
  ...payoutSchema,
  ...routeSchema,
};

export * from "./admin-schema";
export * from "./auth-schema";
export * from "./driver-schema";
export * from "./payment-schema";
export * from "./payout-schema";
export * from "./route-schema";

export type { PaymentRecord, RefundRecord } from "./payment-schema";
export type { BookingRecord, TripRecord, RouteRecord, VehicleRecord, ExternalDriverRecord } from "./route-schema";
export type { EarningRecord, PayoutRecord } from "./payout-schema";
export type { DriverRecord, DriverStatsRecord } from "./driver-schema";
export type { UserRecord, UserProviderRecord } from "./auth-schema";
