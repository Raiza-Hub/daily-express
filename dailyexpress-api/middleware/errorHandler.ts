import type { Request, Response, NextFunction } from "express";
import type { ServiceError } from "../types/index";
import { sentryServer } from "@shared/sentry";
import type { JWTPayload } from "@shared/types";
import { logger } from "../utils/logger";
import { getDefaultErrorMessage, sendErrorResponse } from "./apiResponses";

interface ExpressError extends ServiceError {
  status?: number;
  type?: string;
}

function getErrorStatusCode(err: ExpressError): number {
  const statusCode = err.statusCode || err.status || 500;
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
    ? statusCode
    : 500;
}

function getUserFacingMessage(err: ExpressError, statusCode: number): string {
  if (statusCode >= 500) {
    return getDefaultErrorMessage(statusCode);
  }

  if (err.type === "entity.parse.failed") {
    return "Request body must be valid JSON.";
  }

  return err.message || getDefaultErrorMessage(statusCode);
}

export function errorHandler(
  err: ExpressError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = getErrorStatusCode(err);
  const isServerError = statusCode >= 500;
  const message = getUserFacingMessage(err, statusCode);
  const code = err.code;

  logger.error("request.error", {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code: code || (isServerError ? "INTERNAL_ERROR" : "REQUEST_FAILED"),
    timestamp: new Date().toISOString(),
  });

  const requestUser = req.user as Partial<JWTPayload> | undefined;

  sentryServer.captureException(err, requestUser?.userId || "unknown", {
    action: "dailyexpress_api_request_error",
    method: req.method,
    path: req.originalUrl,
    statusCode,
    code: code || (isServerError ? "INTERNAL_ERROR" : "REQUEST_FAILED"),
  });

  sendErrorResponse(res, statusCode, message, {
    ...(code ? { code } : {}),
    details: !isServerError && "details" in err ? err.details : undefined,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  logger.warn("request.not_found", {
    method: req.method,
    path: req.path,
  });

  sendErrorResponse(
    res,
    404,
    "We could not find that Daily Express endpoint.",
    {
      code: "ROUTE_NOT_FOUND",
    },
  );
}
