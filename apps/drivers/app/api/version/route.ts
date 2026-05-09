import { NextResponse } from "next/server";
import { resolveAppVersion } from "@repo/ui/lib/resolve-app-version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { version: resolveAppVersion() },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
