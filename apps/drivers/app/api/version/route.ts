import { NextResponse } from "next/server";
import { resolveAppVersion } from "@repo/ui/lib/resolve-app-version";

export const dynamic = "force-dynamic";

export function GET() {
  const version = resolveAppVersion(process.env);

  return NextResponse.json(
    { version },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
