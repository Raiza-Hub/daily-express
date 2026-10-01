import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { NavbarUser } from "~/components/NavbarUser";
import { hasDriverProfile } from "~/lib/driver-session";

const driverCtaClassName =
    "cursor-pointer rounded-full border border-neutral-300 px-5 py-2 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50";
const signInClassName =
    "cursor-pointer rounded-full bg-neutral-900 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-neutral-800";

async function NavbarActions() {
    const cookieStore = await cookies();
    const hasSession = !!(
        cookieStore.get("token") || cookieStore.get("refreshToken")
    );

    let hasProfile = false;
    if (hasSession) {
        hasProfile = await hasDriverProfile();
    }

    const showDriverCta = !hasSession || !hasProfile;

    return (
        <div className="flex items-center gap-3">
            {hasSession ? (
                <>
                    {showDriverCta && (
                        <Link href="/driver/signup" className={driverCtaClassName}>
                            Become a driver
                        </Link>
                    )}
                    <NavbarUser />
                </>
            ) : (
                <>
                    <Link href="/driver/signup" className={driverCtaClassName}>
                        Become a driver
                    </Link>
                    <Link href="/login" className={signInClassName}>
                        Sign in
                    </Link>
                </>
            )}
        </div>
    );
}

export function Navbar() {
    return (
        <nav className="sticky top-0 z-50">
            <div className="max-w-7xl mx-auto flex h-16 items-center px-6">
                <Link href="/">
                    <Image
                        src="/logo.png"
                        width={120}
                        height={40}
                        alt="Beckon"
                        className="h-10 w-auto object-contain"
                        priority
                    />
                </Link>

                <ul className="flex items-center gap-6 ml-10">
                    <li>
                        <Link
                            href="/#how-it-works"
                            className="text-sm font-medium transition-colors"
                        >
                            How It Works
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/#faq"
                            className="text-sm font-medium transition-colors"
                        >
                            About Us
                        </Link>
                    </li>
                    <li>
                        <Link
                            href="/#faq"
                            className="text-sm font-medium transition-colors"
                        >
                            FAQ
                        </Link>
                    </li>
                </ul>

                <div className="flex items-center gap-3 ml-auto">
                    <Suspense fallback={null}>
                        <NavbarActions />
                    </Suspense>
                </div>
            </div>
        </nav>
    );
}