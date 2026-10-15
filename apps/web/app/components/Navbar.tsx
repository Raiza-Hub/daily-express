import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { NavbarNav } from "~/components/NavbarNav";
import { readSession } from "~/lib/session-token";

export async function Navbar() {
  const cookieStore = await cookies();
  const session = await readSession(
    cookieStore.get("token")?.value,
    cookieStore.get("refreshToken")?.value,
  );
  const hasSession = session !== null;

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

        <NavbarNav hasSession={hasSession} isDriver={session?.isDriver === true} />
      </div>
    </nav>
  );
}
