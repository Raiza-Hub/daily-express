import { getConfig } from "../config/index.js";
import { createServiceProxy } from "./createServiceProxy.js";

const config = getConfig();

export default createServiceProxy({
  target: config.AUTH_SERVICE_URL,
  serviceName: "Auth service",
  errorCode: "AUTH_SERVICE_ERROR",
});
