import type { Request, Response, NextFunction } from "express";

export interface RequestLoggingOptions {
  ignorePaths?: string[];
}

function getHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  return typeof value === "string" ? value : value?.[0];
}

function buildRouteLabel(req: Request): string | undefined {
  if (!req.route?.path) {
    return req.baseUrl || undefined;
  }
  return `${req.baseUrl || ""}${req.route.path}`;
}

export function createRequestLoggingMiddleware(
  options?: RequestLoggingOptions,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const requestId =
      getHeaderValue(req.headers["x-request-id"]) || crypto.randomUUID();
    const correlationId =
      getHeaderValue(req.headers["x-correlation-id"]) || requestId;
    const start = Date.now();

    req.headers["x-request-id"] = requestId;
    req.headers["x-correlation-id"] = correlationId;
    res.setHeader("x-request-id", requestId);
    res.setHeader("x-correlation-id", correlationId);

    res.on("finish", () => {
      const durationMs = Date.now() - start;
      const route = buildRouteLabel(req);

      if (options?.ignorePaths?.includes(req.path)) {
        return;
      }

      const level =
        res.statusCode >= 500
          ? "ERROR"
          : res.statusCode >= 400
            ? "WARN"
            : "INFO";
      console.log(
        `[${level}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`,
      );
    });

    next();
  };
}
