import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { PaymentService } from "./paymentService";
import type { PaystackWebhookPayload } from "./types";

const paymentService = new PaymentService();

function getAuthenticatedUserId(req: Request) {
  return req.user?.userId || null;
}

function getAuthenticatedUserEmail(req: Request) {
  return req.user?.email || null;
}

function getRouteParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : null;
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

    const payment = await paymentService.initializePayment(userId, email, req.body);

    return res
      .status(201)
      .json(createSuccessResponse(payment, "Payment initialized successfully"));
  },
);

export const getPaymentByReference: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const reference = getRouteParam(req.params.reference);

    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    if (!reference) {
      return res
        .status(400)
        .json(createErrorResponse("Payment reference is required"));
    }

    const payment = await paymentService.getPaymentByReference(userId, reference);

    return res
      .status(200)
      .json(createSuccessResponse(payment, "Payment fetched successfully"));
  },
);

export const refreshPaymentStatus: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const userId = getAuthenticatedUserId(req);
    const reference = getRouteParam(req.params.reference);

    if (!userId) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    if (!reference) {
      return res
        .status(400)
        .json(createErrorResponse("Payment reference is required"));
    }

    const payment = await paymentService.refreshPaymentStatus(userId, reference);

    return res
      .status(200)
      .json(createSuccessResponse(payment, "Payment status refreshed successfully"));
  },
);

export const handleWebhook: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await paymentService.processWebhook({
      signature: req.header("x-paystack-signature") || undefined,
      rawBody: req.rawBody,
      event: req.body as PaystackWebhookPayload,
    });

    return res.sendStatus(200);
  },
);
