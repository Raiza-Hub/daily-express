import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";

const DAILYEXPRESS_API_URL = env.NEXT_PUBLIC_DAILYEXPRESS_API_URL;

function createErrorPayload(message: string, statusCode: number, code: string) {
  return {
    success: false,
    message,
    error: message,
    code,
    statusCode,
  };
}

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;
  const ref = request.nextUrl.searchParams.get("ref");
  const lastName = request.nextUrl.searchParams.get("lastName");

  if (!token && !refreshToken) {
    return NextResponse.json(
      createErrorPayload(
        "Please sign in again to continue.",
        401,
        "AUTHENTICATION_REQUIRED",
      ),
      { status: 401 },
    );
  }

  if (!ref || !lastName) {
    return NextResponse.json(
      createErrorPayload(
        "Booking reference and last name are required.",
        400,
        "MISSING_BOOKING_SEARCH_FIELDS",
      ),
      { status: 400 },
    );
  }

  try {
    const cookieHeader = [
      token ? `token=${token}` : null,
      refreshToken ? `refreshToken=${refreshToken}` : null,
    ]
      .filter(Boolean)
      .join("; ");

    const response = await fetch(
      `${DAILYEXPRESS_API_URL}/api/v1/route/user/bookings/search?ref=${encodeURIComponent(
        ref,
      )}&lastName=${encodeURIComponent(lastName)}`,
      {
        headers: {
          Cookie: cookieHeader,
        },
      },
    );

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Booking search failed:", error);
    return NextResponse.json(
      createErrorPayload(
        "Unable to search booking right now.",
        500,
        "BOOKING_SEARCH_FAILED",
      ),
      { status: 500 },
    );
  }
}
