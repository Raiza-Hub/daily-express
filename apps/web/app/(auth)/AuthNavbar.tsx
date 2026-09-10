import Image from "next/image";
import Link from "next/link";

const AuthNavbar = () => {
    return (
        <nav className="flex items-center justify-start p-2">
            <div className="flex lg:ml-0">
                <Link href="/" className="flex items-center gap-2">
                    <Image
                        src="/nav-logo.png"
                        alt="Daily Express logo"
                        width={28}
                        height={29}
                        className="h-auto w-7 object-contain object-center"
                    />
                    <span className="text-lg sm:text-xl font-medium leading-none">
                      Daily Express
                    </span>
                </Link>
            </div>
        </nav>
    );
};

export default AuthNavbar;
