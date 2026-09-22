import Image from "next/image";

function AuthLogo() {
    return (
        <Image
            src="/auth-nav-logo.png"
            alt="Logo"
            width={100}
            height={75}
            priority
        />
    );
}

export { AuthLogo };