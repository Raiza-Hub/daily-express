import { NextRequest, NextResponse } from "next/server";
import { env } from "~/env";

const API_GATEWAY_URL = env.NEXT_PUBLIC_API_GATEWAY_URL;

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const refreshToken = request.cookies.get("refreshToken")?.value;
  const ref = request.nextUrl.searchParams.get("ref");
  const lastName = request.nextUrl.searchParams.get("lastName");

  if (!token && !refreshToken) {
    return NextResponse.json(
      { success: false, message: "Authentication required" },
      { status: 401 },
    );
  }

  if (!ref || !lastName) {
    return NextResponse.json(
      { success: false, message: "Reference and last name are required" },
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
      `${API_GATEWAY_URL}/api/routes/v1/route/user/bookings/search?ref=${encodeURIComponent(
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
      { success: false, message: "Unable to search booking right now." },
      { status: 500 },
    );
  }
}
