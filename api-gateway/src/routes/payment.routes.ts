import { getConfig } from "../config/index.js";
import { createServiceProxy } from "./createServiceProxy.js";

const config = getConfig();

export default createServiceProxy({
  target: config.PAYMENT_SERVICE_URL,
  serviceName: "Payment service",
  errorCode: "PAYMENT_SERVICE_ERROR",
});
