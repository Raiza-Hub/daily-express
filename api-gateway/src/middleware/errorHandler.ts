import type { Request, Response, NextFunction } from "express";
import type { ServiceError } from "../types/index.js";
import { sentryServer } from "shared/sentry";

export function errorHandler(
  err: ServiceError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const code = err.code || "INTERNAL_ERROR";

  console.error("Error occurred", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    timestamp: new Date().toISOString(),
  });

  const userId =
    (typeof req.headers["x-user-id"] === "string"
      ? req.headers["x-user-id"]
      : req.headers["x-user-id"]?.[0]) || "unknown";

  sentryServer.captureException(err, userId, {
    action: "gateway_error_handler",
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    params: req.params,
    query: req.query,
    body: req.body,
  });

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  console.warn(`Route ${req.method} ${req.path} not found`);

  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: "ROUTE_NOT_FOUND",
  });
}

export function serviceUnavailableHandler(
  req: Request,
  res: Response,
  serviceName: string,
): void {
  console.error(`Service unavailable: ${serviceName}`, {
    method: req.method,
    path: req.originalUrl,
  });

  res.status(503).json({
    success: false,
    message: `Service temporarily unavailable. Please try again later.`,
    code: "SERVICE_UNAVAILABLE",
  });
}
