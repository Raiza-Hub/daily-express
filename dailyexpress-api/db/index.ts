import { authSchema } from "./auth-schema";
import { driverSchema } from "./driver-schema";
import { notification } from "./notification-schema";
import { paymentSchema } from "./payment-schema";
import { payoutSchema } from "./payout-schema";
import { routeSchema } from "./route-schema";

export const schema = {
  ...authSchema,
  ...driverSchema,
  notification,
  ...paymentSchema,
  ...payoutSchema,
  ...routeSchema,
};

export * from "./auth-schema";
export * from "./driver-schema";
export * from "./notification-schema";
export * from "./payment-schema";
export * from "./payout-schema";
export * from "./route-schema";
