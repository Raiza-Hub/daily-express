import type { ApiResponse, OriginDetails } from "@shared/types";

const DAILYEXPRESS_API_URL =
  process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

export async function fetchOrigins(): Promise<OriginDetails[]> {
  const response = await fetch(
    `${DAILYEXPRESS_API_URL}/api/v1/route/origins`,
    {
      headers: { Accept: "application/json" },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch origins (${response.status} ${response.statusText})`,
    );
  }

  const payload = (await response.json()) as ApiResponse<OriginDetails[]>;
  if (!payload?.success || !payload.data) {
    throw new Error(payload?.message || "Failed to get origins");
  }

  return payload.data;
}
