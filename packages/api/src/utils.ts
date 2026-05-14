import axios from "axios";

export type ApiFieldErrors = Record<string, string[]>;

interface ApiErrorPayload {
  success?: false;
  message?: string;
  error?: string;
  code?: string;
  statusCode?: number;
  requestId?: string;
  errors?: ApiFieldErrors;
  details?: unknown;
}

export class ApiError extends Error {
  code?: string;
  statusCode?: number;
  requestId?: string;
  errors?: ApiFieldErrors;
  details?: unknown;

  constructor(message: string, payload: ApiErrorPayload = {}) {
    super(message);
    this.name = "ApiError";
    this.code = payload.code;
    this.statusCode = payload.statusCode;
    this.requestId = payload.requestId;
    this.errors = payload.errors;
    this.details = payload.details;
  }
}

const PROVIDER_ERROR_PREFIX_PATTERN = /^[A-Z][A-Za-z0-9 _-]* API error:\s*/i;

type SetFieldError<TFieldName extends string> = (
  name: TFieldName,
  error: { type: "server"; message: string },
) => void;

function getFirstFieldError(errors?: ApiFieldErrors): string | undefined {
  const message = errors
    ? Object.values(errors).flat().find(Boolean)
    : undefined;
  return message ? normalizeApiErrorMessage(message) : undefined;
}

function normalizeApiErrorMessage(message: string): string {
  return message.replace(PROVIDER_ERROR_PREFIX_PATTERN, "").trim() || message;
}

function normalizeApiErrorPayload(value: unknown): ApiErrorPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as ApiErrorPayload;
  return {
    message: payload.message
      ? normalizeApiErrorMessage(payload.message)
      : undefined,
    error: payload.error ? normalizeApiErrorMessage(payload.error) : undefined,
    code: payload.code,
    statusCode: payload.statusCode,
    requestId: payload.requestId,
    errors: payload.errors,
    details: payload.details,
  };
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getApiErrorMessage(
  error: unknown,
  fallbackMessage: string,
): string {
  if (error instanceof ApiError) {
    return error.message || fallbackMessage;
  }

  if (error instanceof Error) {
    return error.message || fallbackMessage;
  }

  return fallbackMessage;
}

export function applyApiFieldErrors<TFieldName extends string>(
  error: unknown,
  setError: SetFieldError<TFieldName>,
  fieldMap: Partial<Record<string, TFieldName | TFieldName[]>> = {},
): boolean {
  if (!(error instanceof ApiError) || !error.errors) {
    return false;
  }

  let applied = false;

  for (const [field, messages] of Object.entries(error.errors)) {
    const message = messages.find(Boolean);
    if (!message) {
      continue;
    }

    const mappedFields = fieldMap[field] || (field as TFieldName);
    const fieldNames = Array.isArray(mappedFields)
      ? mappedFields
      : [mappedFields];

    for (const fieldName of fieldNames) {
      setError(fieldName, {
        type: "server",
        message: normalizeApiErrorMessage(message),
      });
      applied = true;
    }
  }

  return applied;
}

export const handleApiError = (
  err: unknown,
  fallbackMessage: string,
): never => {
  if (axios.isAxiosError(err)) {
    if (err.response?.data) {
      const payload = normalizeApiErrorPayload(err.response.data);
      if (payload) {
        const message =
          getFirstFieldError(payload.errors) ||
          payload.error ||
          payload.message ||
          fallbackMessage;

        throw new ApiError(message, {
          ...payload,
          statusCode: payload.statusCode || err.response.status,
        });
      }
    }
    if (err.request) {
      throw new ApiError("Unable to connect to server", {
        code: "NETWORK_ERROR",
      });
    }
  }
  if (err instanceof Error) {
    throw err;
  }
  throw new Error(fallbackMessage);
};
