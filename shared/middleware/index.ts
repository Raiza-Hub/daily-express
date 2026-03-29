import type { RequestHandler, Request, Response, NextFunction } from "express";
import {
  logError,
  type JWTPayload,
  type ServiceError,
  type ServiceResponse,
  type User,
} from "../types";
import { createErrorResponse, createServiceError } from "../utils";
import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import axios from "axios";

declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

// export function authenticateToken(
//   req: Request,
//   res: Response,
//   next: NextFunction,
// ) {
//   // Commenting out Bearer token logic
//   // const authHeader = req.headers["authorization"];
//   // const token = authHeader && authHeader.split(" ")[1];

//   // Read token from HTTP-only cookie
//   const token = req.cookies?.token;

//   if (!token) {
//     return res.status(401).json(createErrorResponse("No token provided"));
//   }
//   const jwtSecret = process.env.JWT_SECRET;
//   if (!jwtSecret) {
//     return res
//       .status(500)
//       .json(createErrorResponse("JWT Seceret is not defined"));
//   }

//   try {
//     const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
//     if (!decoded.emailVerified) {
//       throw createServiceError(
//         "Email not verified, Please Verify Your Account",
//         401,
//       );
//     }
//     req.user = decoded;
//     next();
//   } catch (error) {
//     if (error instanceof jwt.TokenExpiredError) {
//       return res.status(403).json(createErrorResponse("Token expired"));
//     }
//     if (error instanceof jwt.JsonWebTokenError) {
//       return res.status(403).json(createErrorResponse("Invalid token"));
//     }
//     return res.status(500).json(createErrorResponse("Token validation failed"));
//   }
// }

export function authenticateTokenFromCookie(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json(createErrorResponse("No token provided"));
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res
      .status(500)
      .json(createErrorResponse("JWT Seceret is not defined"));
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    if (!decoded.emailVerified) {
      throw createServiceError(
        "Email not verified, Please Verify Your Account",
        401,
      );
    }
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json(createErrorResponse("Token expired"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json(createErrorResponse("Invalid token"));
    }
    return res.status(500).json(createErrorResponse("Token validation failed"));
  }
}

export function authenticateTokenFromCookieUnverified(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  // Read token from HTTP-only cookie
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).json(createErrorResponse("No token provided"));
  }
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    return res
      .status(500)
      .json(createErrorResponse("JWT Seceret is not defined"));
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    req.user = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json(createErrorResponse("Token expired"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json(createErrorResponse("Invalid token"));
    }
    return res.status(500).json(createErrorResponse("Token validation failed"));
  }
}

export function refreshAndValidateCookie(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const accessToken = req.cookies?.token;
  const refreshToken = req.cookies?.refreshToken;
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!jwtSecret || !jwtRefreshSecret) {
    return res
      .status(500)
      .json(createErrorResponse("JWT Secret is not defined"));
  }

  if (accessToken) {
    try {
      const decoded = jwt.verify(accessToken, jwtSecret) as JWTPayload;
      if (decoded.emailVerified) {
        req.user = decoded;
        return next();
      }
    } catch (error) {
      if (!(error instanceof jwt.TokenExpiredError)) {
        return res.status(401).json(createErrorResponse("Invalid token"));
      }
    }
  }

  if (!refreshToken) {
    return res
      .status(401)
      .json(createErrorResponse("Session Expired, Please Login"));
  }

  try {
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as JWTPayload;

    // Check if user is verified
    if (!decoded.emailVerified) {
      return res
        .status(401)
        .json(
          createErrorResponse("Email not verified, Please Verify Your Account"),
        );
    }

    const accessTokenOptions: SignOptions = {
      expiresIn: "15m",
    };
    const refreshTokenOptions: SignOptions = {
      expiresIn: "7d",
    };

    const newAccessToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        emailVerified: decoded.emailVerified,
      },
      jwtSecret as Secret,
      accessTokenOptions,
    ) as string;

    const newRefreshToken = jwt.sign(
      {
        userId: decoded.userId,
        email: decoded.email,
        emailVerified: decoded.emailVerified,
      },
      jwtRefreshSecret as Secret,
      refreshTokenOptions,
    ) as string;

    res.cookie("token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    req.user = decoded;
    next();
  } catch (error) {
    return res
      .status(401)
      .json(createErrorResponse("Invalid or expired refresh token"));
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function validateRequest(schema: any) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Added abortEarly: false to catch ALL errors at once
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      // 2. Use the 'errors' object we actually defined
      const errors: Record<string, string[]> = {};

      error.details.forEach((details: any) => {
        const field = details.path.join(".");
        if (!errors[field]) {
          errors[field] = [];
        }
        errors[field].push(details.message);
      });

      return res.status(400).json({
        success: false,
        message: "Validation Error",
        errors, // This now contains mapped messages
      });
    }
    req.body = value;
    next();
  };
}

export function errorHandler(
  error: ServiceError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  logError(error, {
    method: req.method,
    url: req.url,
    body: req.body,
    params: req.params,
    query: req.query,
  });
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Serer Error";

  res.status(statusCode).json(createErrorResponse(message));

  next();
}

export function corsOptions() {
  return {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: process.env.CORS_CREDENTIALS === "true",
  };
}
