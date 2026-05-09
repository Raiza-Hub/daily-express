import * as Sentry from "@sentry/bun";
import { sentryServer, sanitizeForSentry } from "@shared/sentry";

type LogFields = Record<string, unknown>;
type LogLevel = "debug" | "info" | "warn" | "error";

const isDevelopment =
  process.env.NODE_ENV === "development" ||
  process.env.DAILYEXPRESS_API_LOG_CONSOLE === "true";

function sanitizeFields(fields?: LogFields): LogFields | undefined {
  if (!fields) {
    return undefined;
  }

  return sanitizeForSentry(fields) as LogFields;
}

function writeConsole(level: LogLevel, event: string, fields?: LogFields) {
  if (!isDevelopment) {
    return;
  }

  const prefix = `[${level.toUpperCase()}] ${event}`;
  if (level === "warn") {
    console.warn(prefix, fields);
    return;
  }

  if (level === "error") {
    console.error(prefix, fields);
    return;
  }

  console.log(prefix, fields);
}

function sendSentryLog(level: LogLevel, event: string, fields?: LogFields) {
  if (process.env.NODE_ENV === "test" || isDevelopment) {
    return;
  }

  const sanitized = sanitizeFields(fields);

  if (level === "warn") {
    Sentry.logger.warn(event, sanitized);
    return;
  }

  if (level === "error") {
    Sentry.logger.error(event, sanitized);
  }
}

function log(level: LogLevel, event: string, fields?: LogFields) {
  writeConsole(level, event, fields);
  sendSentryLog(level, event, fields);
}

function child(baseFields: LogFields) {
  return {
    debug(event: string, fields?: LogFields) {
      log("debug", event, { ...baseFields, ...fields });
    },
    info(event: string, fields?: LogFields) {
      log("info", event, { ...baseFields, ...fields });
    },
    warn(event: string, fields?: LogFields) {
      log("warn", event, { ...baseFields, ...fields });
    },
    error(event: string, fields?: LogFields) {
      log("error", event, { ...baseFields, ...fields });
    },
  };
}

export const logger = {
  debug(event: string, fields?: LogFields) {
    log("debug", event, fields);
  },
  info(event: string, fields?: LogFields) {
    log("info", event, fields);
  },
  warn(event: string, fields?: LogFields) {
    log("warn", event, fields);
  },
  error(event: string, fields?: LogFields) {
    log("error", event, fields);
  },
  child,
};

export function reportError(error: unknown, fields: LogFields = {}) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const details = {
    ...fields,
    message: normalizedError.message,
    stack: normalizedError.stack,
    timestamp: new Date().toISOString(),
  };

  writeConsole("error", "error.occurred", details);
  sentryServer.captureException(normalizedError, "system", {
    action: typeof fields.action === "string" ? fields.action : "reportError",
    ...details,
  });
}
