import type { Metadata } from "next";
import { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "~/components/Navbar";
import Footer from "@repo/ui/Footer";
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
    const apiGatewayUrl = env.NEXT_PUBLIC_API_GATEWAY_URL;

    try {
        const profileResponse = await fetch(
            `${apiGatewayUrl}/api/drivers/v1/driver/profile`,
            {
                headers: {
                    cookie: cookieHeader,
                },
                cache: "no-store",
            },
        );

        if (!profileResponse.ok) {
            redirect(signInUrl.toString());
        }
    } catch {
        redirect(signInUrl.toString());
    }

    return (
        <div className="w-full min-h-screen flex flex-col">
            <div className="bg-white sticky top-0 z-50">
                <Navbar />
            </div>

            <div className="w-full flex flex-col flex-1">
                {children}
            </div>
            <Footer className="px-4 md:px-6 mt-auto" />
        </div>
    );
}

export default Layout;
