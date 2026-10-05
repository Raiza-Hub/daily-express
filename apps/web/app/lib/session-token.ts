import { jwtVerify } from "jose";

export const JWT_VERIFY_OPTIONS = {
  issuer: "dailyexpress-api",
  audience: "dailyexpress-app",
  algorithms: ["HS256"],
};

export interface SessionClaims {
  userId: string;
  email: string;
  isDriver: boolean;
}

function secret(name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): Uint8Array | null {
  const value = process.env[name];

  return value ? new TextEncoder().encode(value) : null;
}

function toClaims(payload: unknown): SessionClaims | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const { userId, email, isDriver } = payload as Record<string, unknown>;

  if (typeof userId !== "string" || typeof email !== "string") {
    return null;
  }

  return { userId, email, isDriver: isDriver === true };
}

async function verify(
  token: string | undefined,
  secretName: "JWT_SECRET" | "JWT_REFRESH_SECRET",
): Promise<SessionClaims | null> {
  const key = secret(secretName);

  if (!token || !key) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, key, JWT_VERIFY_OPTIONS);

    return toClaims(payload);
  } catch {
    return null;
  }
}

/* The access token is short-lived and the refresh token longer, so an idle
   session can present only a valid refresh token. Both are signed from the same
   payload, so either one yields the same claims. */
export async function readSession(
  accessToken?: string,
  refreshToken?: string,
): Promise<SessionClaims | null> {
  return (
    (await verify(accessToken, "JWT_SECRET")) ??
    (await verify(refreshToken, "JWT_REFRESH_SECRET"))
  );
}
