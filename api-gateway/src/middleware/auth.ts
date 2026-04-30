import type { CookieOptions, Request, Response, NextFunction } from "express";
import jwt, {
  type Secret,
  type SignOptions,
  type JwtPayload as JsonWebTokenPayload,
} from "jsonwebtoken";
import { getConfig } from "../config/index.js";
import type { AuthenticatedRequest, JWTPayload } from "../types/index.js";
import { getRequestPath, isPublicPath } from "./publicPaths.js";

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const ACCESS_TOKEN_EXPIRES_IN: SignOptions["expiresIn"] = "15m";
const REFRESH_TOKEN_EXPIRES_IN: SignOptions["expiresIn"] = "7d";
const USER_NOT_FOUND_SESSION_INVALID_BEFORE = new Date(8640000000000000);

interface InternalSessionStateResponse {
  success: boolean;
  data?: {
    sessionInvalidBefore?: string | null;
  };
}

function isJwtPayload(
  payload: string | JsonWebTokenPayload,
): payload is JWTPayload {
  return (
    typeof payload !== "string" &&
    typeof payload.userId === "string" &&
    typeof payload.email === "string" &&
    typeof payload.emailVerified === "boolean" &&
    (payload.role === undefined || typeof payload.role === "string")
  );
}

function getCookieDomain(config: ReturnType<typeof getConfig>) {
  if (config.NODE_ENV !== "production") {
    return undefined;
  }

  return process.env.COOKIE_DOMAIN || ".dailyexpress.app";
}

function clearAuthCookies(
  res: Response,
  config: ReturnType<typeof getConfig>,
): void {
  const cookieDomain = getCookieDomain(config);
  const clearCookieOptions = cookieDomain ? { domain: cookieDomain } : {};

  res.clearCookie("token", clearCookieOptions);
  res.clearCookie("refreshToken", clearCookieOptions);
}

function setAuthenticatedUser(
  req: AuthenticatedRequest,
  payload: JWTPayload,
): void {
  req.user = payload;
  req.headers["x-user-id"] = payload.userId;
  req.headers["x-user-email"] = payload.email;
  req.headers["x-user-email-verified"] = String(payload.emailVerified);
  if (payload.role) {
    req.headers["x-user-role"] = payload.role;
    return;
  }

  delete req.headers["x-user-role"];
}

function setAuthCookies(
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
    ...(payload.role ? { role: payload.role } : {}),
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

async function getSessionInvalidBefore(
  config: ReturnType<typeof getConfig>,
  userId: string,
): Promise<Date | null> {
  const response = await fetch(
    `${config.AUTH_SERVICE_URL}/v1/auth/internal/users/${encodeURIComponent(userId)}/session`,
    {
      headers: {
        "x-internal-service-token": config.INTERNAL_SERVICE_TOKEN,
      },
    },
  );

  if (response.status === 404) {
    return USER_NOT_FOUND_SESSION_INVALID_BEFORE;
  }

  if (!response.ok) {
    throw new Error(
      `Failed to fetch user session state: ${response.status} ${response.statusText}`,
    );
  }

  const body = (await response.json()) as InternalSessionStateResponse;

  if (!body.success) {
    throw new Error("Failed to fetch user session state");
  }

  if (!body.data?.sessionInvalidBefore) {
    return null;
  }

  const sessionInvalidBefore = new Date(body.data.sessionInvalidBefore);
  return Number.isNaN(sessionInvalidBefore.getTime())
    ? null
    : sessionInvalidBefore;
}

export function authMiddleware(
  req: AuthenticatedRequest,
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
      config,
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

    console.error("Token validation failed", error);
    res.status(500).json({
      success: false,
      message: "Token validation failed",
    });
  });
}
