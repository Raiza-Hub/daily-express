import type { CookieOptions, Request, Response, NextFunction } from "express";
import jwt, {
  type Secret,
  type SignOptions,
  type JwtPayload as JsonWebTokenPayload,
} from "jsonwebtoken";
import { getConfig } from "../config/index";
import type { JWTPayload } from "@shared/types";
import { logger } from "../utils/logger";
import { sendErrorResponse } from "./apiResponses";

const DURATION_UNIT_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

function expiresInToMs(value: string): number {
  const n = parseInt(value, 10);
  return n * (DURATION_UNIT_MS[value.slice(-1)] ?? 1000);
}

function isJwtPayload(
  payload: string | JsonWebTokenPayload,
): payload is JWTPayload {
  return (
    typeof payload !== "string" &&
    typeof payload.userId === "string" &&
    typeof payload.email === "string"
  );
}

export function getCookieDomain(config: ReturnType<typeof getConfig>) {
  if (config.NODE_ENV !== "production") {
    return undefined;
  }

  return config.COOKIE_DOMAIN || ".dailyexpress.app";
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

function setAuthenticatedUser(req: Request, payload: JWTPayload): void {
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
    isDriver: payload.isDriver ?? false,
  };

  const tokenSignOptions: SignOptions = {
    expiresIn: config.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: "dailyexpress-api",
    audience: "dailyexpress-app",
  };

  const accessToken = jwt.sign(accessPayload, config.JWT_SECRET as Secret, tokenSignOptions);

  const refreshToken = jwt.sign(
    accessPayload,
    config.JWT_REFRESH_SECRET as Secret,
    { ...tokenSignOptions, expiresIn: config.JWT_REFRESH_EXPIRES_IN as SignOptions["expiresIn"] },
  );

  res.cookie(
    "token",
    accessToken,
    getCookieOptions(expiresInToMs(config.JWT_EXPIRES_IN)),
  );
  res.cookie(
    "refreshToken",
    refreshToken,
    getCookieOptions(expiresInToMs(config.JWT_REFRESH_EXPIRES_IN)),
  );
}

export function authenticateSession(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const accessToken = req.cookies?.token;
  const refreshToken = req.cookies?.refreshToken;
  const config = getConfig();

  const verifyOptions = {
    issuer: "dailyexpress-api",
    audience: "dailyexpress-app",
  };

  void (async () => {
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, config.JWT_SECRET as Secret, verifyOptions);

        if (!isJwtPayload(decoded)) {
          clearAuthCookies(res, config);
          sendErrorResponse(res, 401, "Please sign in again to continue.", {
            code: "INVALID_TOKEN",
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
      sendErrorResponse(
        res,
        401,
        "Your session has expired. Please sign in again.",
        {
          code: "SESSION_EXPIRED",
        },
      );
      return;
    }

    const refreshed = jwt.verify(
      refreshToken,
      config.JWT_REFRESH_SECRET as Secret,
      verifyOptions,
    );

    if (!isJwtPayload(refreshed) || typeof refreshed.iat !== "number") {
      clearAuthCookies(res, config);
      sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "INVALID_TOKEN",
      });
      return;
    }

    setAuthCookies(res, refreshed, config);
    setAuthenticatedUser(req, refreshed);
    next();
  })().catch((error) => {
    if (error instanceof jwt.TokenExpiredError) {
      clearAuthCookies(res, config);
      sendErrorResponse(
        res,
        401,
        "Your session has expired. Please sign in again.",
        {
          code: "SESSION_EXPIRED",
        },
      );
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      clearAuthCookies(res, config);
      sendErrorResponse(res, 401, "Please sign in again to continue.", {
        code: "INVALID_TOKEN",
      });
      return;
    }

    try {
      logger.error("auth.token_validation_failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } catch {
      // Logger failure is non-fatal
    }
    sendErrorResponse(res, 500, undefined, {
      code: "TOKEN_VALIDATION_FAILED",
    });
    return;
  });
}

export function getAuthenticatedUser(req: Request): JWTPayload | null {
  const user = req.user as Partial<JWTPayload> | undefined;

  if (
    !user ||
    typeof user.userId !== "string" ||
    typeof user.email !== "string"
  ) {
    return null;
  }

  return {
    userId: user.userId,
    email: user.email,
    isDriver: user.isDriver === true,
  };
}

