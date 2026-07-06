import type { Metadata } from "next";
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DriverRealtimeSync } from "~/components/DriverRealtimeSync";
import Navbar from "~/components/Navbar";
import { env } from "~/env";

export const metadata: Metadata = {
    robots: {
        index: false,
        follow: false,
        googleBot: {
            index: false,
            follow: false,
        },
    },
};

const Layout = async ({ children }: { children: ReactNode }) => {
    const cookieStore = await cookies();
    const token = cookieStore.get("token")?.value;
    const refreshToken = cookieStore.get("refreshToken")?.value;
    const hasAuth = Boolean(token || refreshToken);
    const webAppUrl = env.NEXT_PUBLIC_WEB_APP_URL;
    const signInUrl = new URL("/sign-in", webAppUrl);
    signInUrl.searchParams.set("redirect", "/");

    if (!hasAuth) {
        redirect(signInUrl.toString());
    }

    const cookieHeader = [
        token ? `token=${token}` : null,
        refreshToken ? `refreshToken=${refreshToken}` : null,
    ]
        .filter(Boolean)
        .join("; ");
    const dailyExpressApiUrl = env.NEXT_PUBLIC_DAILYEXPRESS_API_URL;

    let shouldRedirectToSignIn = false;
    try {
        const profileResponse = await fetch(
            `${dailyExpressApiUrl}/api/v1/driver/profile`,
            {
                headers: {
                    cookie: cookieHeader,
                },
                cache: "no-store",
            },
        );
        if (profileResponse.ok) {
            const data = await profileResponse.json();
            shouldRedirectToSignIn = !data.success || !data.data;
        } else {
            shouldRedirectToSignIn = true;
        }
    } catch {
        shouldRedirectToSignIn = true;
    }
    if (shouldRedirectToSignIn) redirect(signInUrl.toString());

    return (
        <div className="w-full min-h-screen flex flex-col">
            <div className="bg-white sticky top-0 z-50">
                <Navbar />
            </div>

            <div className="w-full flex flex-col flex-1">
                <DriverRealtimeSync />
                {children}
            </div>
        </div>
    );
}

export default Layout;
