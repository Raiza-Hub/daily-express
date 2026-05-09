import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "./logger";

type TimingFields = Record<string, unknown>;

interface TimingContext {
  requestId?: string;
  correlationId?: string;
  method?: string;
  path?: string;
}

const timingContext = new AsyncLocalStorage<TimingContext>();

function elapsedMs(startedAt: bigint): number {
  return Number((process.hrtime.bigint() - startedAt) / 1_000_000n);
}

export function createTimer() {
  const startedAt = process.hrtime.bigint();

  return {
    elapsedMs() {
      return elapsedMs(startedAt);
    },
  };
}

export function runWithTimingContext<T>(
  context: TimingContext,
  callback: () => T,
): T {
  return timingContext.run(context, callback);
}

export function getTimingContext(): TimingContext {
  return timingContext.getStore() || {};
}

export function logTiming(event: string, fields: TimingFields = {}) {
  logger.info(event, {
    ...getTimingContext(),
    ...fields,
  });
}

export async function timeAsync<T>(
  event: string,
  fields: TimingFields,
  callback: () => Promise<T>,
): Promise<T> {
  const timer = createTimer();

  try {
    const result = await callback();
    logTiming(event, {
      ...fields,
      durationMs: timer.elapsedMs(),
      status: "success",
    });
    return result;
  } catch (error) {
    logTiming(event, {
      ...fields,
      durationMs: timer.elapsedMs(),
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}
