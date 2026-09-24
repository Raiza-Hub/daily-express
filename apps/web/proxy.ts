import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import type { NextProxy, NextRequest } from "next/server";

const JWT_VERIFY_OPTIONS = {
  issuer: "dailyexpress-api",
  audience: "dailyexpress-app",
  algorithms: ["HS256"],
};

const PROTECTED_PREFIXES = [
  "/trip/bookings",
  "/driver/calendar",
  "/driver/signup",
  "/settings",
  "/onboarding",
] as const;

const AUTH_ONLY_PREFIXES = ["/login"] as const;

function matchesPrefix(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

async function hasValidSession(request: NextRequest): Promise<boolean> {
  const accessToken = request.cookies.get("token")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;

  if (accessToken) {
    const secret = process.env.JWT_SECRET;
    if (secret) {
      try {
        await jwtVerify(accessToken, new TextEncoder().encode(secret), JWT_VERIFY_OPTIONS);
        return true;
      } catch {
        // fall through to refresh token check
      }
    }
  }

  if (refreshToken) {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (secret) {
      try {
        await jwtVerify(refreshToken, new TextEncoder().encode(secret), JWT_VERIFY_OPTIONS);
        return true;
      } catch {
        // invalid refresh token
      }
    }
  }

  return false;
}

export const proxy: NextProxy = async (request) => {
  const { pathname, search } = request.nextUrl;

  const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
  const isAuthOnly = matchesPrefix(pathname, AUTH_ONLY_PREFIXES);

  if (!isProtected && !isAuthOnly) {
    return NextResponse.next();
  }

  const hasSession = await hasValidSession(request);

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname + search);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthOnly && hasSession) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api).*)"],
};