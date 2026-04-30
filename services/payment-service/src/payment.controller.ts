import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { paymentService } from "./paymentService";
import type { KoraWebhookPayload } from "./types";

function isKoraWebhookPayload(value: unknown): value is KoraWebhookPayload {
  if (!value || typeof value !== "object") {
    return false;
  }

  const payload = value as Record<string, unknown>;
  const data = payload.data;

  if (!data || typeof data !== "object") {
    return false;
  }

  const webhookData = data as Record<string, unknown>;

  return (
    typeof payload.event === "string" &&
    typeof webhookData.status === "string" &&
    typeof webhookData.currency === "string" &&
    (typeof webhookData.reference === "string" ||
      typeof webhookData.payment_reference === "string") &&
    (typeof webhookData.amount === "number" ||
      typeof webhookData.amount === "string")
  );
}

function getAuthenticatedUserId(req: Request) {
  return req.user?.userId || null;
}

function getAuthenticatedUserEmail(req: Request) {
  return req.user?.email || null;
}

export const initializePayment: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const email = getAuthenticatedUserEmail(req);

    if (!userId || !email) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const payment = await paymentService.initializePayment(
      userId,
      email,
      req.body,
    );

    return res
      .status(201)
      .json(createSuccessResponse(payment, "Payment initialized successfully"));
  },
);

export const upsertBookingHold: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await paymentService.upsertBookingHold(req.body);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Booking hold upserted successfully"));
  },
);

export const handleWebhook: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!isKoraWebhookPayload(req.body)) {
      return res
        .status(400)
        .json(createErrorResponse("Invalid Kora webhook payload"));
    }

    await paymentService.handleKoraWebhook(
      req.body,
      req.header("x-korapay-signature") || undefined,
    );

    return res.status(200).json({ received: true });
  },
);

export const handleReturn: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const reference =
      typeof req.query.ref === "string"
        ? req.query.ref
        : typeof req.query.reference === "string"
          ? req.query.reference
          : null;
    const providerStatus =
      typeof req.query.status === "string"
        ? req.query.status
        : typeof req.query.result === "string"
          ? req.query.result
          : null;

    const redirectUrl = await paymentService.resolveReturnUrl(
      reference,
      providerStatus,
    );
    return res.redirect(redirectUrl);
  },
);
