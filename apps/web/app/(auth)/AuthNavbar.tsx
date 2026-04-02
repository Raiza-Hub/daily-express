import Image from "next/image";
import Link from "next/link";
import { Icons } from "@repo/ui/Icons";

const AuthNavbar = () => {
    return (
        <nav className="flex items-center justify-start p-2">
            <div className="flex lg:ml-0">
                <Link href='/'>
                    <Image
                        src="/logo2.png"
                        alt="Logo"
                        width={40}
                        height={40}
                        className='object-contain object-center'
                    />
                </Link>
            </div>
        </nav>
    );
};

export default AuthNavbar;
