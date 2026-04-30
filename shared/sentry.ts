import * as Sentry from "@sentry/bun";
import type { Event, Span } from "@sentry/bun";

const SENSITIVE_KEY_PATTERN =
  /authorization|cookie|password|secret|token|session|api[-_]?key|otp|account(number)?/i;
const DEFAULT_FLUSH_TIMEOUT_MS = 2000;

type Primitive = string | number | boolean | null;
type SentryEventContext = NonNullable<Event["contexts"]>[string];
type SentryStartSpanOptions = Parameters<typeof Sentry.startSpan>[0];

function parseRate(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    return undefined;
  }

  return parsed;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return undefined;
}

function sanitizeKeyValue(key: string, value: unknown, depth = 0): unknown {
  if (SENSITIVE_KEY_PATTERN.test(key)) {
    return "[REDACTED]";
  }

  return sanitizeForSentry(value, depth + 1);
}

export function sanitizeForSentry(value: unknown, depth = 0): unknown {
  if (value == null) {
    return value as Primitive;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (depth >= 4) {
    return Array.isArray(value) ? "[Array]" : "[Object]";
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 20)
      .map((entry) => sanitizeForSentry(entry, depth + 1));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).slice(
      0,
      50,
    );
    return Object.fromEntries(
      entries.map(([key, entryValue]) => [
        key,
        sanitizeKeyValue(key, entryValue, depth + 1),
      ]),
    );
  }

  return String(value);
}

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function normalizeUserId(userId?: string): string | null {
  if (!userId || userId === "unknown" || userId === "system") {
    return null;
  }

  return userId;
}

function sanitizeEvent<TEvent extends Event>(event: TEvent): TEvent {
  if (event.request) {
    if (event.request.headers) {
      event.request.headers = sanitizeForSentry(
        event.request.headers,
      ) as Record<string, string>;
    }

    if (event.request.data) {
      event.request.data = sanitizeForSentry(event.request.data);
    }
  }

  if (event.extra) {
    event.extra = sanitizeForSentry(event.extra) as Record<string, unknown>;
  }

  if (event.contexts) {
    event.contexts = sanitizeForSentry(event.contexts) as Record<
      string,
      SentryEventContext
    >;
  }

  return event;
}

let initialized = false;

export function initSentry(options: {
  serviceName: string;
  environment?: string;
  release?: string;
}) {
  const environment =
    options.environment ||
    process.env.SENTRY_ENVIRONMENT ||
    process.env.NODE_ENV ||
    "development";

  if (environment === "test") {
    return;
  }

  if (initialized) {
    Sentry.setTag("service", options.serviceName);
    return;
  }

  initialized = true;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: Boolean(process.env.SENTRY_DSN),
    environment,
    release: options.release || process.env.SENTRY_RELEASE,
    enableLogs: parseBoolean(process.env.SENTRY_ENABLE_LOGS) ?? true,
    integrations: [
      Sentry.consoleLoggingIntegration({
        levels: ["debug", "info", "warn", "error", "log"],
      }),
    ],
    sampleRate: parseRate(process.env.SENTRY_ERROR_SAMPLE_RATE) ?? 1,
    tracesSampleRate: parseRate(process.env.SENTRY_TRACES_SAMPLE_RATE) ?? 1,
    maxBreadcrumbs: 100,
    sendDefaultPii: parseBoolean(process.env.SENTRY_SEND_DEFAULT_PII) ?? true,
    initialScope: {
      tags: {
        service: options.serviceName,
      },
    },
    beforeSend(event) {
      return sanitizeEvent(event);
    },
  });

  Sentry.setTag("service", options.serviceName);
}

export const sentryServer = {
  captureException(
    error: unknown,
    distinctId?: string,
    additionalProperties?: Record<string, unknown>,
  ) {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    const normalizedError = normalizeError(error);
    const userId = normalizeUserId(distinctId);

    Sentry.withScope((scope) => {
      if (userId) {
        scope.setUser({ id: userId });
      }

      if (additionalProperties) {
        const sanitizedDetails = sanitizeForSentry(
          additionalProperties,
        ) as Record<string, unknown>;

        if (typeof sanitizedDetails.action === "string") {
          scope.setTag("action", sanitizedDetails.action);
        }

        scope.setContext("details", sanitizedDetails);
        scope.setExtras(sanitizedDetails);
      }

      Sentry.captureException(normalizedError);
    });
  },

  async flush(timeoutMs = DEFAULT_FLUSH_TIMEOUT_MS) {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    await Sentry.flush(timeoutMs);
  },

  async shutdown(timeoutMs = DEFAULT_FLUSH_TIMEOUT_MS) {
    if (process.env.NODE_ENV === "test") {
      return;
    }
    await Sentry.close(timeoutMs);
  },
};

export function getTraceHeaders() {
  if (process.env.NODE_ENV === "test") {
    return {
      baggage: undefined,
      "sentry-trace": undefined,
    };
  }

  const traceData = Sentry.getTraceData();

  return {
    baggage: traceData.baggage,
    "sentry-trace": traceData["sentry-trace"],
  };
}

export function continueTrace<T>(
  input: { sentryTrace?: string | null; baggage?: string | null },
  callback: () => T,
): T {
  if (process.env.NODE_ENV === "test") {
    return callback();
  }
  return Sentry.continueTrace(
    {
      baggage: input.baggage || undefined,
      sentryTrace: input.sentryTrace || undefined,
    },
    callback,
  );
}

export function startSentrySpan<T>(
  options: SentryStartSpanOptions,
  callback: (span: Span) => T,
): T {
  return Sentry.startSpan(options, callback);
}
