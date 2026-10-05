import { cache } from "react";
import { cookies } from "next/headers";
import type { ApiResponse, User } from "@shared/types";

const DAILYEXPRESS_API_URL =
    process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

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