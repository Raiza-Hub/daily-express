import { cache } from "react";
import { cookies } from "next/headers";
import type { ApiResponse, Driver } from "@shared/types";

const DAILYEXPRESS_API_URL =
    process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

export type DriverProfileState = "active" | "none" | "unknown";

interface DriverProfileResult {
    state: DriverProfileState;
    driver: Driver | null;
}

const loadDriverProfile = cache(async (): Promise<DriverProfileResult> => {
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
        throw new Error(`Failed to load driver profile (${response.status})`);
    }

    const payload = (await response.json()) as ApiResponse<Driver | null>;

    return payload.data
        ? { state: "active", driver: payload.data }
        : { state: "none", driver: null };
});

export async function getDriverProfile(): Promise<Driver | null> {
    return (await loadDriverProfile()).driver;
}

export async function getDriverProfileState(): Promise<DriverProfileState> {
    try {
        return (await loadDriverProfile()).state;
    } catch {
        return "unknown";
    }
}
