import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import { sendErrorResponse } from "./apiResponses";
import { loadConfig } from "../config";

export function requireAppsmithSignature(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const config = loadConfig();
  const secret = config.APPSMITH_SIGNATURE_SECRET;

  if (!secret) {
    next();
    return;
  }

  const signature = req.headers["x-appsmith-signature"];
  if (typeof signature !== "string" || !signature.trim()) {
    sendErrorResponse(res, 401, "Appsmith signature header required.", {
      code: "APPSMITH_SIGNATURE_REQUIRED",
    });
    return;
  }

  try {
    jwt.verify(signature, secret, { algorithms: ["HS256"] });
    next();
  } catch {
    sendErrorResponse(res, 401, "Invalid Appsmith signature.", {
      code: "INVALID_APPSMITH_SIGNATURE",
    });
  }
}
