import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { getAuthenticatedUser } from "../middleware/auth";
import { NotificationService } from "./notificationService";
import { timeAsync } from "../utils/timing";

const notificationService = new NotificationService();

export const getNotifications: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const result = await timeAsync(
      "notification.list.service",
      {
        userId: gatewayUser.userId,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
        hasCursor: Boolean(req.query.cursor),
        unreadOnly: req.query.unreadOnly === "true",
      },
      () =>
        notificationService.getNotifications(gatewayUser, {
          limit: req.query.limit ? Number(req.query.limit) : undefined,
          cursor: req.query.cursor ? String(req.query.cursor) : undefined,
          unreadOnly: req.query.unreadOnly === "true",
        }),
    );

    return res
      .status(200)
      .json(createSuccessResponse(result, "Notifications fetched successfully"));
  },
);

export const markNotificationRead: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      return res
        .status(400)
        .json(createErrorResponse("Notification ID is required"));
    }

    const updated = await timeAsync(
      "notification.mark_read.service",
      { userId: gatewayUser.userId, notificationId: id },
      () => notificationService.markNotificationRead(gatewayUser, id),
    );

    return res
      .status(200)
      .json(createSuccessResponse(updated, "Notification marked as read"));
  },
);

export const markAllNotificationsRead: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const gatewayUser = getAuthenticatedUser(req);
    if (!gatewayUser) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    await timeAsync(
      "notification.mark_all_read.service",
      { userId: gatewayUser.userId },
      () => notificationService.markAllNotificationsRead(gatewayUser),
    );

    return res
      .status(200)
      .json(createSuccessResponse(null, "Notifications marked as read"));
  },
);
