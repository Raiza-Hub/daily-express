export const logger = {
  debug(event: string, fields?: Record<string, unknown>) {
    console.log(`[DEBUG] ${event}`, fields);
  },
  info(event: string, fields?: Record<string, unknown>) {
    console.log(`[INFO] ${event}`, fields);
  },
  warn(event: string, fields?: Record<string, unknown>) {
    console.warn(`[WARN] ${event}`, fields);
  },
  error(event: string, fields?: Record<string, unknown>) {
    console.error(`[ERROR] ${event}`, fields);
  },
  child(baseFields: Record<string, unknown>) {
    return {
      debug(event: string, fields?: Record<string, unknown>) {
        console.log(`[DEBUG] ${event}`, { ...baseFields, ...fields });
      },
      info(event: string, fields?: Record<string, unknown>) {
        console.log(`[INFO] ${event}`, { ...baseFields, ...fields });
      },
      warn(event: string, fields?: Record<string, unknown>) {
        console.warn(`[WARN] ${event}`, { ...baseFields, ...fields });
      },
      error(event: string, fields?: Record<string, unknown>) {
        console.error(`[ERROR] ${event}`, { ...baseFields, ...fields });
      },
    };
  },
};

export function reportError(
  error: unknown,
  fields: Record<string, unknown> = {},
) {
  if (error instanceof Error) {
    console.error("Error occurred", {
      message: error.message,
      stack: error.stack,
      ...fields,
      timestamp: new Date().toISOString(),
    });
  } else {
    console.error("Error occurred", {
      error: String(error),
      ...fields,
      timestamp: new Date().toISOString(),
    });
  }
}
