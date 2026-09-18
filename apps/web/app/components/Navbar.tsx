import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";

export async function Navbar() {
    const cookieStore = await cookies();
    const hasSession = !!(
        cookieStore.get("access_token") || cookieStore.get("refresh_token")
    );
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
                    {/* TODO: wire to driver app + sign-in routes */}
                    <div className="cursor-pointer rounded-full border border-neutral-300 px-5 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
                        Become a driver
                    </div>
                    <div className="cursor-pointer rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-neutral-800">
                        Sign in
                    </div>
                </div>
            </div>
        </nav>
    );
}