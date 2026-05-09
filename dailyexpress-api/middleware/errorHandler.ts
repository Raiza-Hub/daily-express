import type { Request, Response, NextFunction } from "express";
import type { ServiceError } from "../types/index";
import { sentryServer } from "@shared/sentry";
import type { JWTPayload } from "@shared/types";
import { logger } from "../utils/logger";

export function errorHandler(
  err: ServiceError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const code = err.code || "INTERNAL_ERROR";

  logger.error("request.error", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
    timestamp: new Date().toISOString(),
  });

  const requestUser = req.user as Partial<JWTPayload> | undefined;

  sentryServer.captureException(err, requestUser?.userId || "unknown", {
    action: "dailyexpress_api_request_error",
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code,
  });

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  logger.warn("request.not_found", {
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
    code: "ROUTE_NOT_FOUND",
  });
}
