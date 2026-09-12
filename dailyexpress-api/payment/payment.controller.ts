import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import z from "zod/v4";
import { getAuthenticatedUser } from "../middleware/auth";
import { sendErrorResponse } from "../middleware/apiResponses";
import { paymentService } from "./payment.service";
import type {
  InitializePaymentInput,
  KoraWebhookPayload,
} from "./payment.types";
import { timeAsync } from "../utils/timing";

const koraWebhookPayloadSchema = z.object({
  event: z.string(),
  data: z.object({
    status: z.string(),
    currency: z.string(),
    reference: z.string(),
    amount: z.number().or(z.string()),
  }),
});

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
  async (_req: Request, res: Response) => {
    const redirectUrl = await timeAsync("payment.return.service", {}, () =>
      paymentService.resolveReturnUrl(),
    );
    return res.redirect(redirectUrl);
  },
);

function isKoraWebhookPayload(value: unknown): value is KoraWebhookPayload {
  return koraWebhookPayloadSchema.safeParse(value).success;
}
