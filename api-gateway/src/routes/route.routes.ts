import { getConfig } from "../config/index.js";
import { createServiceProxy } from "./createServiceProxy.js";

const config = getConfig();

export default createServiceProxy({
  target: config.ROUTE_SERVICE_URL,
  serviceName: "Route service",
  errorCode: "ROUTE_SERVICE_ERROR",
});
