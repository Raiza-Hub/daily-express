import { cache } from "react";
import { cookies } from "next/headers";
import type { ApiResponse, Driver } from "@shared/types";

const DAILYEXPRESS_API_URL =
    process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

export type DriverProfileState = "active" | "none" | "deactivated";

export const getDriverProfileState = cache(async (): Promise<DriverProfileState> => {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const refreshToken = cookieStore.get("refreshToken")?.value;

    const cookieHeader = [token && `token=${token}`, refreshToken && `refreshToken=${refreshToken}`]
        .filter(Boolean)
        .join("; ");

    const response = await fetch(
        `${DAILYEXPRESS_API_URL}/api/v1/driver/profile`,
        {
            headers: { Accept: "application/json", Cookie: cookieHeader },
            cache: "no-store",
        },
    );

    if (!response.ok) {
        if (response.status === 403) {
            const payload = (await response.json().catch(() => null)) as
                | { code?: string }
                | null;

            if (payload?.code === "DRIVER_DEACTIVATED") {
                return "deactivated";
            }
        }

        throw new Error(`Failed to load driver profile (${response.status})`);
    }

    const payload = (await response.json()) as ApiResponse<Driver | null>;

    return payload.data ? "active" : "none";
});
