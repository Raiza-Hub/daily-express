import { getConfig } from "../config/index.js";
import { createServiceProxy } from "./createServiceProxy.js";

const config = getConfig();

export default createServiceProxy({
  target: config.NOTIFICATION_SERVICE_URL,
  serviceName: "Notification service",
  errorCode: "NOTIFICATION_SERVICE_ERROR",
});
