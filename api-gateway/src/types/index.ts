import type { Request } from "express";

export interface JWTPayload {
  userId: string;
  email: string;
  emailVerified: boolean;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface ServiceError extends Error {
  statusCode?: number;
  code?: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: Record<string, string[]>;
}

export interface UserContext {
  userId: string;
  email: string;
  emailVerified: boolean;
  role?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: UserContext;
}

export type HttpMethod =
  | "GET"
  | "POST"
  | "PUT"
  | "PATCH"
  | "DELETE"
  | "OPTIONS"
  | "HEAD";

export interface GatewayUserHeaders {
  "x-user-id"?: string;
  "x-user-email"?: string;
  "x-user-email-verified"?: string;
  "x-user-role"?: string;
  "x-request-id"?: string;
  "x-correlation-id"?: string;
  baggage?: string;
  "sentry-trace"?: string;
}
