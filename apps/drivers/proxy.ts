import { NextRequest, NextResponse } from "next/server";
import { env } from "./app/env";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("token")?.value;
  const refreshToken = req.cookies.get("refreshToken")?.value;
  const hasAuth = !!(token || refreshToken);

  if (!hasAuth) {
    return NextResponse.redirect(
      new URL("/sign-in", env.NEXT_PUBLIC_WEB_APP_URL),
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|opengraph-image|twitter-image|.*\\.png$).*)",
  ],
};
