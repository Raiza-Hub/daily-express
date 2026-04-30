import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { PayoutService } from "./payoutService";
import type { KoraPayoutWebhookPayload } from "./types";

const payoutService = new PayoutService();

function getAuthenticatedUser(req: Request) {
  return req.user || null;
}

export const getBalance: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const balance = await payoutService.getBalance(user);
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
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const history = await payoutService.getHistory(user, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor:
        typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      status:
        typeof req.query.status === "string"
          ? (req.query.status as any)
          : undefined,
    });

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
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const week = typeof req.query.week === "string" ? req.query.week : null;
    if (!week) {
      return res.status(400).json(createErrorResponse("week is required"));
    }

    const summary = await payoutService.getSummary(user, week);
    return res
      .status(200)
      .json(
        createSuccessResponse(summary, "Payout summary fetched successfully"),
      );
  },
);

export const resolveBankAccount: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const resolved = await payoutService.resolveBankAccount(req.body);

    return res
      .status(200)
      .json(
        createSuccessResponse(resolved, "Bank account resolved successfully"),
      );
  },
);

export const handleWebhook: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await payoutService.processWebhook({
      signature: req.header("x-korapay-signature"),
      rawBody: req.rawBody,
      event: req.body as KoraPayoutWebhookPayload,
    });

    return res.sendStatus(200);
  },
);
