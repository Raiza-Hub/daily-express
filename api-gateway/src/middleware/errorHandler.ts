import type { Request, Response, NextFunction } from "express";
import type { ServiceError } from "../types/index.js";

export function errorHandler(
  err: ServiceError,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  const code = err.code || "INTERNAL_ERROR";

  console.error(`[${new Date().toISOString()}] Error:`, {
    method: req.method,
    path: req.path,
    statusCode,
    message,
    code,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  console.warn(`[${new Date().toISOString()}] 404 Not Found:`, {
    method: req.method,
    path: req.path,
  });

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
  console.error(
    `[${new Date().toISOString()}] Service unavailable: ${serviceName}`,
    {
      method: req.method,
      path: req.path,
    },
  );

  res.status(503).json({
    success: false,
    message: `Service temporarily unavailable. Please try again later.`,
    code: "SERVICE_UNAVAILABLE",
  });
}
