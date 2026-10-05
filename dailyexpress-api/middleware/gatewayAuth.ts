import type { Request, Response, NextFunction } from "express";
import type { JWTPayload } from "@shared/types";
import { sendErrorResponse } from "./apiResponses";

function parseGatewayUser(req: Request): JWTPayload | null {
  const requestUser = req.user as Partial<JWTPayload> | undefined;

  if (
    requestUser &&
    typeof requestUser.userId === "string" &&
    typeof requestUser.email === "string"
  ) {
    return {
      userId: requestUser.userId,
      email: requestUser.email,
      isDriver: requestUser.isDriver === true,
    };
  }

  return null;
}

export function authenticateGatewayRequest(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const gatewayUser = parseGatewayUser(req);

  if (!gatewayUser) {
    sendErrorResponse(res, 401, "Please sign in again to continue.", {
      code: "AUTHENTICATION_REQUIRED",
    });
    return;
  }

  req.user = gatewayUser;
  next();
}
