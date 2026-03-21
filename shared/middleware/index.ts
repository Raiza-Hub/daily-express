import type { RequestHandler, Request, Response, NextFunction } from "express";
import {
  logError,
  type JWTPayload,
  type ServiceError,
  type ServiceResponse,
  type User,
} from "../types";
import { createErrorResponse, createServiceError } from "../utils";
import jwt from "jsonwebtoken";
import axios from "axios";

export function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  // const refreshToken =

  if (!token) {
    return res.status(401).json(createErrorResponse("No token provided"));
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res
      .status(500)
      .json(createErrorResponse("JWT Seceret is not defined"));
  }

  const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
  if (!decoded.emailVerified) {
    throw createServiceError(
      "Email not verified, Please Verify Your Account",
      401,
    );
  }
  req.user = decoded;
  next();
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
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
        errors[field].push(details.message);
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
  next: NextFunction,
) {
  logError(error, {
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
  });
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Serer Error";

  res.status(statusCode).json(createErrorResponse(message));

  next();
}

export function corsOptions() {
  return {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: process.env.CORS_CREDENTIALS === "true",
  };
}
