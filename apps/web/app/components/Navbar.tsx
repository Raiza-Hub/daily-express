import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { NavbarNav } from "~/components/NavbarNav";
import { getDriverProfileState, type DriverProfileState } from "~/lib/driver-session";

interface NavbarView {
    hasSession: boolean;
    showDriverCta: boolean;
    showDriverLink: boolean;
}

function navView(hasSession: boolean, driver: DriverProfileState): NavbarView {
    return {
        hasSession,
        showDriverCta: !hasSession || driver === "none",
        showDriverLink: hasSession && driver === "active",
    };
}

async function NavbarSession() {
    return <NavbarNav {...navView(true, await getDriverProfileState())} />;
}

export async function Navbar() {
    const cookieStore = await cookies();
    const hasSession = !!(
        cookieStore.get("token") || cookieStore.get("refreshToken")
    );

    return (
        <nav className="sticky top-0 z-50 bg-background">
            <div className="mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
                <Link href="/">
                    <Image
                        src="/logo.png"
                        width={120}
                        height={40}
                        alt="Daily Express"
                        className="h-10 w-auto object-contain"
                        priority
                    />
                </Link>

                {hasSession ? (
                    <Suspense
                        fallback={<NavbarNav {...navView(true, "unknown")} />}
                    >
                        <NavbarSession />
                    </Suspense>
                ) : (
                    <NavbarNav {...navView(false, "none")} />
                )}
            </div>
        </nav>
    );
}
