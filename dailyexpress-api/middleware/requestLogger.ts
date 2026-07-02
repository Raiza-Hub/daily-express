import type { Request, Response, NextFunction } from "express";
import {
  createTimer,
  logTiming,
  runWithTimingContext,
} from "../utils/timing";
import { getHeaderValue } from "./utils";

export interface RequestLoggingOptions {
  ignorePaths?: string[];
}

export function createRequestLoggingMiddleware(
  options?: RequestLoggingOptions,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId =
      getHeaderValue(req.headers["x-request-id"]) || crypto.randomUUID();
    const correlationId =
      getHeaderValue(req.headers["x-correlation-id"]) || requestId;
    const timer = createTimer();

    req.headers["x-request-id"] = requestId;
    req.headers["x-correlation-id"] = correlationId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-correlation-id", correlationId);

    runWithTimingContext(
      {
        requestId,
        correlationId,
        method: req.method,
        path: req.originalUrl,
      },
      () => {
        res.on("finish", () => {
          const durationMs = timer.elapsedMs();

          if (options?.ignorePaths?.includes(req.path)) {
            return;
          }

          logTiming("api.request.completed", {
            statusCode: res.statusCode,
            durationMs,
          });
        });

        next();
      },
    );
  };
}
