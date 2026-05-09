import type { CookieOptions, Request, Response, NextFunction } from "express";
import jwt, {
  type Secret,
  type SignOptions,
  type JwtPayload as JsonWebTokenPayload,
} from "jsonwebtoken";
import { getConfig } from "../config/index";
import type { JWTPayload } from "@shared/types";
import { createServiceError } from "@shared/utils";
import { getRequestPath, isPublicPath } from "./publicPaths";
import { db } from "../db/connection";
import { users } from "../db/index";
import { eq } from "drizzle-orm";
import { logger } from "../utils/logger";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_EXPIRES_IN: SignOptions["expiresIn"] = "15m";
const REFRESH_TOKEN_EXPIRES_IN: SignOptions["expiresIn"] = "7d";

function isJwtPayload(
  payload: string | JsonWebTokenPayload,
): payload is JWTPayload {
  return (
    typeof payload !== "string" &&
    typeof payload.userId === "string" &&
    typeof payload.email === "string" &&
    typeof payload.emailVerified === "boolean"
  );
}

export function getCookieDomain(config: ReturnType<typeof getConfig>) {
  if (config.NODE_ENV !== "production") {
    return undefined;
  }

  return process.env.COOKIE_DOMAIN || ".dailyexpress.app";
}

export function clearAuthCookies(
  res: Response,
  config: ReturnType<typeof getConfig>,
): void {
  const cookieDomain = getCookieDomain(config);
  const clearCookieOptions = cookieDomain ? { domain: cookieDomain } : {};

  res.clearCookie("token", clearCookieOptions);
  res.clearCookie("refreshToken", clearCookieOptions);
}

export function setAuthenticatedUser(req: Request, payload: JWTPayload): void {
  req.user = payload;
}

export function setAuthCookies(
  res: Response,
  payload: JWTPayload,
  config: ReturnType<typeof getConfig>,
): void {
  const cookieDomain = getCookieDomain(config);
  const getCookieOptions = (maxAge: number): CookieOptions => ({
    httpOnly: true,
    secure: config.NODE_ENV === "production",
    sameSite: "lax",
    maxAge,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  });

  const accessPayload = {
    userId: payload.userId,
    email: payload.email,
    emailVerified: payload.emailVerified,
  };

  const accessToken = jwt.sign(accessPayload, config.JWT_SECRET as Secret, {
    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    accessPayload,
    config.JWT_REFRESH_SECRET as Secret,
    {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    },
  );

  res.cookie("token", accessToken, getCookieOptions(ACCESS_TOKEN_MAX_AGE_MS));
  res.cookie(
    "refreshToken",
    refreshToken,
    getCookieOptions(REFRESH_TOKEN_MAX_AGE_MS),
  );
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const path = getRequestPath(req);
  const method = req.method;

  if (isPublicPath(path, method)) {
    return next();
  }

  const accessToken = req.cookies?.token;
  const refreshToken = req.cookies?.refreshToken;
  const config = getConfig();

  void (async () => {
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, config.JWT_SECRET as Secret);

        if (!isJwtPayload(decoded)) {
          clearAuthCookies(res, config);
          res.status(401).json({
            success: false,
            message: "Invalid token payload. Please login again.",
          });
          return;
        }

        setAuthenticatedUser(req, decoded);
        next();
        return;
      } catch (error) {
        if (!(error instanceof jwt.TokenExpiredError)) {
          throw error;
        }
      }
    }

    if (!refreshToken) {
      clearAuthCookies(res, config);
      res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
      return;
    }

    const refreshed = jwt.verify(
      refreshToken,
      config.JWT_REFRESH_SECRET as Secret,
    );

    if (!isJwtPayload(refreshed) || typeof refreshed.iat !== "number") {
      clearAuthCookies(res, config);
      res.status(401).json({
        success: false,
        message: "Invalid refresh token payload. Please login again.",
      });
      return;
    }

    const sessionInvalidBefore = await getSessionInvalidBefore(
      refreshed.userId,
    );
    if (
      sessionInvalidBefore &&
      refreshed.iat * 1000 < sessionInvalidBefore.getTime()
    ) {
      clearAuthCookies(res, config);
      res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
      return;
    }

    setAuthCookies(res, refreshed, config);
    setAuthenticatedUser(req, refreshed);
    next();
  })().catch((error) => {
    if (error instanceof jwt.TokenExpiredError) {
      clearAuthCookies(res, config);
      res.status(401).json({
        success: false,
        message: "Session expired. Please login again.",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      clearAuthCookies(res, config);
      res.status(401).json({
        success: false,
        message: "Invalid token. Please login again.",
      });
      return;
    }

    logger.error("auth.token_validation_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      message: "Token validation failed",
    });
  });
}

async function getSessionInvalidBefore(userId: string): Promise<Date | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { sessionInvalidBefore: true },
  });

  if (!user) {
    return new Date(8640000000000000);
  }

  return user.sessionInvalidBefore || null;
}

export function getAuthenticatedUser(req: Request): JWTPayload | null {
  const user = req.user as Partial<JWTPayload> | undefined;

  if (
    !user ||
    typeof user.userId !== "string" ||
    typeof user.email !== "string" ||
    typeof user.emailVerified !== "boolean"
  ) {
    return null;
  }

  return {
    userId: user.userId,
    email: user.email,
    emailVerified: user.emailVerified,
  };
}

export function requireAuthenticatedUser(req: Request): JWTPayload {
  const user = getAuthenticatedUser(req);
  if (!user) {
    throw createServiceError("User not authenticated", 401);
  }

  return user;
}

export function requireVerifiedAuthenticatedUser(req: Request): JWTPayload {
  const user = requireAuthenticatedUser(req);
  if (!user.emailVerified) {
    throw createServiceError(
      "Email not verified, Please Verify Your Account",
      401,
    );
  }

  return user;
}
