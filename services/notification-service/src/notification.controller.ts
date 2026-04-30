import type { Request, RequestHandler, Response } from "express";
import { asyncHandler } from "@shared/middleware";
import { createErrorResponse, createSuccessResponse } from "@shared/utils";
import { NotificationService } from "./notificationService";

const notificationService = new NotificationService();

function getAuthenticatedUser(req: Request) {
  return req.user || null;
}

export const getNotifications: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    const result = await notificationService.getNotifications(user, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      cursor: req.query.cursor ? String(req.query.cursor) : undefined,
      unreadOnly: req.query.unreadOnly === "true",
    });

    return res
      .status(200)
      .json(
        createSuccessResponse(result, "Notifications fetched successfully"),
      );
  },
);

export const markNotificationRead: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
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

    const updated = await notificationService.markNotificationRead(user, id);

    return res
      .status(200)
      .json(createSuccessResponse(updated, "Notification marked as read"));
  },
);

export const markAllNotificationsRead: RequestHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("User not authenticated"));
    }

    await notificationService.markAllNotificationsRead(user);

    return res
      .status(200)
      .json(createSuccessResponse(null, "Notifications marked as read"));
  },
);
