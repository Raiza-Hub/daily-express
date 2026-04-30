import { NextRequest, NextResponse } from "next/server";
import {
  buildLocationRequesterId,
  LocationRateLimitError,
  suggestLocationsForRequester,
} from "@repo/ui/lib/location-server";

export const runtime = "nodejs";

function getRequesterId(request: NextRequest) {
  return buildLocationRequesterId({
    token: request.cookies.get("token")?.value,
    refreshToken: request.cookies.get("refreshToken")?.value,
    ip:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip"),
  });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") ?? "";

  try {
    const suggestions = await suggestLocationsForRequester(
      query,
      getRequesterId(request),
    );
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof LocationRateLimitError) {
      return NextResponse.json(
        { message: error.message },
        {
          status: 429,
          headers: {
            "Retry-After": String(error.retryAfterSeconds),
          },
        },
      );
    }

    console.error("Location suggest failed:", error);
    return NextResponse.json(
      { message: "Unable to search locations right now." },
      { status: 500 },
    );
  }
}
