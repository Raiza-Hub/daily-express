import { cache } from "react";
import { cookies } from "next/headers";
import type { ApiResponse, User } from "@shared/types";

const DAILYEXPRESS_API_URL =
    process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

/**
 * Resolves the signed-in user for server-side route guards.
 *
 * 401 (a session the proxy accepted but the API rejects), 403
 * (EMAIL_NOT_VERIFIED) and 404 (a JWT pointing at a deleted user row) all mean
 * "we cannot confirm who this is" rather than "the backend is broken", so they
 * resolve to null and the caller renders the page instead. Every other non-2xx
 * throws, so an outage surfaces as an error rather than a silently blank view.
 *
 * Wrapped in cache() so a page guard and any other consumer rendered in the
 * same pass share a single request.
 */
export const getUserProfile = cache(async (): Promise<User | null> => {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const refreshToken = cookieStore.get("refreshToken")?.value;

    const cookieHeader = [
        token && `token=${token}`,
        refreshToken && `refreshToken=${refreshToken}`,
    ]
        .filter(Boolean)
        .join("; ");

    const response = await fetch(
        `${DAILYEXPRESS_API_URL}/api/v1/auth/profile`,
        {
            headers: { Accept: "application/json", Cookie: cookieHeader },
            cache: "no-store",
        },
    );

    if (response.status === 401 || response.status === 403 || response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Failed to load user profile (${response.status})`);
    }

    const payload = (await response.json()) as ApiResponse<User>;
    return payload?.success && payload.data ? payload.data : null;
});