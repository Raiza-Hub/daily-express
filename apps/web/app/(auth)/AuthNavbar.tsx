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
                    <h1 className="text-xl font-semibold leading-none">Daily Express</h1>
                </Link>
            </div>
        </nav>
    );
};

export default AuthNavbar;
