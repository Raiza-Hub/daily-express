import type { Response } from "express";

export type FieldErrors = Record<string, string[]>;

export interface ErrorResponseOptions {
  code?: string;
  errors?: FieldErrors;
  details?: unknown;
  requestId?: string;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
  error: string;
  code: string;
  statusCode: number;
  requestId?: string;
  errors?: FieldErrors;
  details?: unknown;
}

const DEFAULT_MESSAGES: Record<number, string> = {
  400: "We could not process that request. Check the information and try again.",
  401: "Please sign in again to continue.",
  403: "You do not have permission to perform this action.",
  404: "We could not find what you requested.",
  409: "That request conflicts with the current state. Refresh and try again.",
  413: "That upload is too large. Try a smaller file.",
  415: "That file type is not supported.",
  422: "Some information needs your attention before we can continue.",
  429: "Too many requests. Please try again shortly.",
  500: "Something went wrong. Please try again in a moment.",
  502: "A connected service is temporarily unavailable. Please try again shortly.",
  503: "Daily Express is temporarily unavailable. Please try again shortly.",
  504: "The request took too long. Please try again shortly.",
};

const PROVIDER_ERROR_PREFIX_PATTERN = /^[A-Z][A-Za-z0-9 _-]* API error:\s*/i;

export function getRequestIdFromResponse(res: Response): string | undefined {
  const value = res.getHeader("x-request-id");
  return typeof value === "string" ? value : undefined;
}

export function getDefaultErrorMessage(statusCode: number): string {
  return (
    DEFAULT_MESSAGES[statusCode] ||
    (statusCode >= 500
      ? DEFAULT_MESSAGES[500]
      : "We could not complete that request. Please try again.")
  );
}

export function formatUserFacingErrorMessage(message: string): string {
  return message.replace(PROVIDER_ERROR_PREFIX_PATTERN, "").trim() || message;
}

export function createErrorPayload(
  statusCode: number,
  message?: string,
  options: ErrorResponseOptions = {},
): ApiErrorResponse {
  const safeStatusCode =
    Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599
      ? statusCode
      : 500;
  const userMessage =
    typeof message === "string" && message.trim()
      ? formatUserFacingErrorMessage(message.trim())
      : getDefaultErrorMessage(safeStatusCode);

  return {
    success: false,
    message: userMessage,
    error: userMessage,
    code: options.code || getDefaultErrorCode(safeStatusCode),
    statusCode: safeStatusCode,
    ...(options.requestId ? { requestId: options.requestId } : {}),
    ...(options.errors ? { errors: options.errors } : {}),
    ...(options.details !== undefined ? { details: options.details } : {}),
  };
}

export function sendErrorResponse(
  res: Response,
  statusCode: number,
  message?: string,
  options: ErrorResponseOptions = {},
): void {
  res.status(statusCode).json(
    createErrorPayload(statusCode, message, {
      ...options,
      requestId: options.requestId || getRequestIdFromResponse(res),
    }),
  );
}

function getDefaultErrorCode(statusCode: number): string {
  switch (statusCode) {
    case 400:
      return "BAD_REQUEST";
    case 401:
      return "UNAUTHORIZED";
    case 403:
      return "FORBIDDEN";
    case 404:
      return "NOT_FOUND";
    case 409:
      return "CONFLICT";
    case 413:
      return "PAYLOAD_TOO_LARGE";
    case 415:
      return "UNSUPPORTED_MEDIA_TYPE";
    case 422:
      return "UNPROCESSABLE_ENTITY";
    case 429:
      return "RATE_LIMITED";
    default:
      return statusCode >= 500 ? "INTERNAL_ERROR" : "REQUEST_FAILED";
  }
}
