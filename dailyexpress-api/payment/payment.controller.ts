import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { sendErrorResponse } from "../middleware/apiResponses";
import { PaymentService } from "./paymentService";
import type {
  InitializePaymentInput,
  KoraWebhookPayload,
} from "./payment.types";
import { timeAsync } from "../utils/timing";

const paymentService = new PaymentService();

export const initializePayment: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
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
      return sendErrorResponse(res, 400, "Invalid payment webhook payload.", {
        code: "INVALID_WEBHOOK_PAYLOAD",
      });
    }

    await timeAsync("payment.webhook.service", { event: req.body.event }, () =>
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
      () => paymentService.resolveReturnUrl(reference, providerStatus),
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
