import { NextResponse } from "next/server";
import type { NextProxy, NextRequest } from "next/server";
import { readSession } from "~/lib/session-token";

const PROTECTED_PREFIXES = [
  "/trip/bookings",
  "/driver/calendar",
  "/driver/deactivated",
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
  const session = await readSession(
    request.cookies.get("token")?.value,
    request.cookies.get("refreshToken")?.value,
  );

  return session !== null;
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