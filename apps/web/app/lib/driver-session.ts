import { cache } from "react";
import { cookies } from "next/headers";
import type { ApiResponse, Driver } from "@shared/types";

const DAILYEXPRESS_API_URL =
    process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

/**
 * Resolves the signed-in user's driver profile.
 *
 * Returns null when the user has no driver profile. Any non-2xx response
 * throws, so backend failures (401, 403 DEACTIVATED, 403 EMAIL_NOT_VERIFIED,
 * 5xx) surface as errors rather than being mistaken for "no profile".
 *
 * Wrapped in cache() so the Navbar and a page guard rendered in the same
 * pass share a single request.
 */
export const getDriverProfile = cache(async (): Promise<Driver | null> => {
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
    return payload.data ?? null;
});

/**
 * Display-only check for the Navbar. Never throws and never blocks rendering.
 */
export async function hasDriverProfile(): Promise<boolean> {
    try {
        return (await getDriverProfile()) !== null;
    } catch {
        return true;
    }
}
