import Image from "next/image";
import Link from "next/link";

export function LegalNavbar() {
    return (
        <nav className="bg-background">
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
            </div>
        </nav>
    );
}
