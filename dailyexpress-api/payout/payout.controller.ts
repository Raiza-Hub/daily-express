import { type Request, type RequestHandler, type Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { sendErrorResponse } from "../middleware/apiResponses";
import { PayoutService } from "./payoutService";
import type { KoraPayoutWebhookPayload } from "../payment/payment.types";
import { timeAsync } from "../utils/timing";

const payoutService = new PayoutService();

export const getBalance: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const balance = await timeAsync(
      "payout.balance.service",
      { userId: user.userId },
      () => payoutService.getBalance(user),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(balance, "Payout balance fetched successfully"),
      );
  },
);

export const getHistory: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const history = await timeAsync(
      "payout.history.service",
      {
        userId: user.userId,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        hasCursor: typeof req.query.cursor === "string",
        status:
          typeof req.query.status === "string" ? req.query.status : undefined,
      },
      () =>
        payoutService.getHistory(user, {
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          cursor:
            typeof req.query.cursor === "string" ? req.query.cursor : undefined,
          status:
            typeof req.query.status === "string"
              ? (req.query.status as any)
              : undefined,
        }),
    );

    return res
      .status(200)
      .json(
        createSuccessResponse(history, "Payout history fetched successfully"),
      );
  },
);

export const getSummary: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "AUTHENTICATION_REQUIRED",
      });
    }

    const week = typeof req.query.week === "string" ? req.query.week : null;
    if (!week) {
      return sendErrorResponse(res, 400, "Week is required.", {
        code: "MISSING_WEEK",
      });
    }

    const summary = await timeAsync(
      "payout.summary.service",
      { userId: user.userId, week },
      () => payoutService.getSummary(user, week),
    );
    return res
      .status(200)
      .json(
        createSuccessResponse(summary, "Payout summary fetched successfully"),
      );
  },
);

export const handleWebhook: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!isKoraPayoutWebhookPayload(req.body)) {
      return sendErrorResponse(res, 400, "Invalid payout webhook payload.", {
        code: "INVALID_WEBHOOK_PAYLOAD",
      });
    }

    await timeAsync("payout.webhook.service", { event: req.body.event }, () =>
      payoutService.processWebhook({
        signature: req.header("x-korapay-signature") || undefined,
        event: req.body,
      }),
    );

    return res.sendStatus(200);
  },
);

function isKoraPayoutWebhookPayload(
  value: unknown,
): value is KoraPayoutWebhookPayload {
  if (!value || typeof value !== "object") return false;
  const payload = value as Record<string, unknown>;
  const data = payload.data;
  if (!data || typeof data !== "object") return false;
  const webhookData = data as Record<string, unknown>;
  return (
    typeof payload.event === "string" &&
    typeof webhookData.reference === "string" &&
    typeof webhookData.status === "string" &&
    typeof webhookData.currency === "string" &&
    (typeof webhookData.amount === "number" ||
      typeof webhookData.amount === "string") &&
    (typeof webhookData.fee === "number" || typeof webhookData.fee === "string")
  );
}
