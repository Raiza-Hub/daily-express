import { getConfig } from "../config/index.js";
import { createServiceProxy } from "./createServiceProxy.js";

const config = getConfig();

export default createServiceProxy({
  target: config.PAYOUT_SERVICE_URL,
  serviceName: "Payout service",
  errorCode: "PAYOUT_SERVICE_ERROR",
});
