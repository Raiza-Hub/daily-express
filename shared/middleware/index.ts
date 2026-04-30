import type { RequestHandler, Request, Response, NextFunction } from "express";
import { type JWTPayload, type ServiceError } from "../types";
import { createErrorResponse } from "../utils";
import { reportError } from "../logger";
import { sentryServer } from "../sentry";

function getHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function parseGatewayUser(req: Request): JWTPayload | null {
  const userId = getHeaderValue(req.headers["x-user-id"]);
  const email = getHeaderValue(req.headers["x-user-email"]);
  const emailVerifiedHeader = getHeaderValue(
    req.headers["x-user-email-verified"],
  );
  const role = getHeaderValue(req.headers["x-user-role"]);

  if (!userId || !email || !emailVerifiedHeader) {
    return null;
  }

  return {
    userId,
    email,
    emailVerified: emailVerifiedHeader === "true",
    role,
  };
}

export function authenticateGatewayRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const gatewayUser = parseGatewayUser(req);

  if (!gatewayUser) {
    return res
      .status(401)
      .json(createErrorResponse("Gateway authentication required"));
  }

  req.user = gatewayUser;
  next();
}

export function authenticateVerifiedGatewayRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const gatewayUser = parseGatewayUser(req);

  if (!gatewayUser) {
    return res
      .status(401)
      .json(createErrorResponse("Gateway authentication required"));
  }

  if (!gatewayUser.emailVerified) {
    return res
      .status(401)
      .json(
        createErrorResponse("Email not verified, Please Verify Your Account"),
      );
  }

  req.user = gatewayUser;
  next();
}

export function authenticateInternalServiceRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): Response | void {
  const expectedToken = process.env.INTERNAL_SERVICE_TOKEN;
  const providedToken = getHeaderValue(req.headers["x-internal-service-token"]);

  if (!expectedToken || !providedToken || providedToken !== expectedToken) {
    return res
      .status(401)
      .json(createErrorResponse("Internal service authentication required"));
  }

  next();
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateRequest(schema: any): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): Response | void => {
    // 1. Added abortEarly: false to catch ALL errors at once
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      // 2. Use the 'errors' object we actually defined
      const errors: Record<string, string[]> = {};

      error.details.forEach((details: any) => {
        const field = details.path.join(".");
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field]?.push(details.message);
      });

      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors, // This now contains mapped messages
      });
    }
    req.body = value;
    next();
  };
}

export function errorHandler(
  error: ServiceError,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const requestUser = (
    req as Request & {
      user?: {
        userId?: string;
        role?: string;
      };
    }
  ).user;

  reportError(error, {
    source: "express",
    method: req.method,
    path: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body,
    actor_id: requestUser?.userId,
    actor_role: requestUser?.role,
  });

  sentryServer.captureException(error, requestUser?.userId || "unknown", {
    action: "express_error_handler",
    method: req.method,
    path: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body,
  });

  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  res.status(statusCode).json(createErrorResponse(message));
}

export function corsOptions() {
  const origins = process.env.CORS_ORIGIN?.split(",").map((o) => o.trim()) || [
    "http://localhost:3000",
  ];
  return {
    origin: origins.length > 1 ? origins : origins[0],
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "baggage",
      "sentry-trace",
    ],
    credentials: process.env.CORS_CREDENTIALS === "true",
  };
}
