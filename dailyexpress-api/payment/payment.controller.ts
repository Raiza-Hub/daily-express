import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { PaymentService } from "./paymentService";
import type { InitializePaymentInput, KoraWebhookPayload } from "./payment.types";
import { timeAsync } from "../utils/timing";

const paymentService = new PaymentService();

export const initializePayment: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return res.status(401).json(createErrorResponse("User not authenticated"));
    }

    const input: InitializePaymentInput = req.body;
    const result = await timeAsync(
      "payment.initialize.service",
      { userId: gatewayUser.userId, bookingId: input.bookingId },
      () =>
        paymentService.initializePayment(
          gatewayUser.userId,
          gatewayUser.email,
          input,
        ),
    );

    return res
      .status(201)
      .json(createSuccessResponse(result, "Payment initialized successfully"));
  },
);

export const handleKoraWebhook: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!isKoraWebhookPayload(req.body)) {
      return res
        .status(400)
        .json(createErrorResponse("Invalid Kora webhook payload"));
    }

    await timeAsync(
      "payment.webhook.service",
      { event: req.body.event },
      () =>
        paymentService.handleKoraWebhook(
          req.body,
          req.header("x-korapay-signature") || undefined,
        ),
    );

    return res.status(200).json({ received: true });
  },
);

export const getPaymentReturn: RequestHandler = asyncHandler(
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

    const redirectUrl = await timeAsync(
      "payment.return.service",
      { hasReference: Boolean(reference), providerStatus },
      () =>
        paymentService.resolveReturnUrl(
          reference,
          providerStatus,
        ),
    );
    return res.redirect(redirectUrl);
  },
);

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
