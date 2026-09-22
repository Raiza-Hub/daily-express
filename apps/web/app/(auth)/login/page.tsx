import Link from "next/link";
import GoogleSignInButton from "~/components/auth/GoogleSigInButton";
import { AuthLogo } from "~/components/auth/AuthLogo";


const Page = () => {
    return (
        <main className="flex flex-col items-center px-4 pt-20 pb-16">
            <div className="flex w-full max-w-sm flex-col space-y-6">
                <div className="flex flex-col items-center space-y-2 text-center">
                    <AuthLogo />
                    <h1 className="text-3xl font-semibold tracking-tight">
                        Sign in or sign up
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Welcome to Beckōn
                    </p>
                </div>

                <GoogleSignInButton />

                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                    By continuing, you acknowledge that you understand and agree to the{" "}
                    <Link href="/terms" className="text-secondary-foreground hover:underline">
                        Terms & Conditions
                    </Link>{" "}
                    and{" "}
                    <Link href="/privacy" className="text-secondary-foreground hover:underline">
                        Privacy Policy.
                    </Link>
                </p>
            </div>
        </main>
    );
};

export default Page;