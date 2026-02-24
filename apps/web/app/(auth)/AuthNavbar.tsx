import Image from "next/image";
import Link from "next/link";
import { Icons } from "~/components/Icons";

const AuthNavbar = () => {
    return (
        <nav className="flex items-center justify-start p-2">
            <div className="ml-4 flex lg:ml-0">
                <Link href="/">
                    {/* <Image
                        src="/hanoled_logo.jpg"
                        alt="Hanoled Logo"
                        width={464}
                        height={94}
                        priority
                        className="object-contain"
                    /> */}
                    <Icons.logo className="h-10 w-10" />
                </Link>
            </div>
        </nav>
    );
};

export default AuthNavbar;
