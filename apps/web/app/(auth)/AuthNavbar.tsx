import Image from "next/image";
import Link from "next/link";

const AuthNavbar = () => {
    return (
        <nav className="flex items-center justify-start p-2">
            <div className="flex lg:ml-0">
                <Link href='/'>
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={520}
                        height={530}
                        className='object-contain object-center'
                        style={{ width: "40px", height: "auto" }}
                    />
                </Link>
            </div>
        </nav>
    );
};

export default AuthNavbar;
