import { Router, type Request, type Response } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import type { ClientRequest } from "node:http";
import type { GatewayUserHeaders } from "../types/index.js";

interface ServiceProxyOptions {
  target: string;
  serviceName: string;
  errorCode: string;
}

function isExpressResponse(
  value: Response | import("node:net").Socket,
): value is Response {
  return "status" in value && "json" in value;
}

function getForwardHeaders(req: Request): GatewayUserHeaders {
  const userId = req.headers["x-user-id"];
  const userEmail = req.headers["x-user-email"];
  const userEmailVerified = req.headers["x-user-email-verified"];
  const userRole = req.headers["x-user-role"];
  const requestId = req.headers["x-request-id"];
  const correlationId = req.headers["x-correlation-id"];
  const sentryTrace = req.headers["sentry-trace"];
  const baggage = req.headers["baggage"];

  return {
    "x-user-id": typeof userId === "string" ? userId : undefined,
    "x-user-email": typeof userEmail === "string" ? userEmail : undefined,
    "x-user-email-verified":
      typeof userEmailVerified === "string" ? userEmailVerified : undefined,
    "x-user-role": typeof userRole === "string" ? userRole : undefined,
    "x-request-id": typeof requestId === "string" ? requestId : undefined,
    "x-correlation-id":
      typeof correlationId === "string" ? correlationId : undefined,
    "sentry-trace":
      typeof sentryTrace === "string" ? sentryTrace : undefined,
    baggage: typeof baggage === "string" ? baggage : undefined,
  };
}

function applyForwardHeaders(
  proxyReq: ClientRequest,
  headers: GatewayUserHeaders,
): void {
  Object.entries(headers).forEach(([name, value]) => {
    if (value) {
      proxyReq.setHeader(name, value);
    }
  });
}

function getContentType(req: Request): string {
  const value = req.headers["content-type"];
  return typeof value === "string" ? value.toLowerCase() : "";
}

function shouldRewriteJsonBody(req: Request): boolean {
  if (!["POST", "PUT", "PATCH"].includes(req.method || "")) {
    return false;
  }

  const contentType = getContentType(req);
  return contentType.includes("application/json") || contentType.includes("+json");
}

export function createServiceProxy({
  target,
  serviceName,
  errorCode,
}: ServiceProxyOptions): Router {
  const router = Router();

  router.use(
    "/",
    createProxyMiddleware<Request, Response>({
      target,
      changeOrigin: true,
      on: {
        proxyReq: (proxyReq, req) => {
          applyForwardHeaders(proxyReq, getForwardHeaders(req));

          if (!shouldRewriteJsonBody(req) || req.body == null) {
            return;
          }

          if (typeof req.body === "object") {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
          }
        },
        error: (error, req, res) => {
          console.error("Proxy request failed", {
            service_name: serviceName,
            path: req.originalUrl,
            error: error.message,
          });
          if (isExpressResponse(res) && !res.headersSent) {
            res.status(502).json({
              success: false,
              message: `${serviceName} unavailable`,
              code: errorCode,
            });
          }
        },
      },
    }),
  );

  return router;
}
