import { getConfig } from "../config/index.js";
import { createServiceProxy } from "./createServiceProxy.js";

const config = getConfig();

export default createServiceProxy({
  target: config.DRIVER_SERVICE_URL,
  serviceName: "Driver service",
  errorCode: "DRIVER_SERVICE_ERROR",
});
