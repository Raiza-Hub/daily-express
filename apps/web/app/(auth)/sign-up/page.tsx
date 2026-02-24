import Link from "next/link";

import { buttonVariants } from "@repo/ui/components/button";
import SignUpForm from "~/components/auth-form/SignUp";

const Page = () => {
    return (
        <main className="flex pt-20 flex-col items-center justify-center lg:px-0">
            <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:max-w-sm">
                <div className="flex flex-col justify-center space-y-2">
                    <h1 className="text-3xl font-semibold tracking-tight">Get started</h1>
                    <p className="text-sm">Create a new account</p>
                </div>

                <SignUpForm />

                <Link
                    className={buttonVariants({
                        variant: "link",
                        className: "gap-1.5",
                    })}
                    href="/sign-in"
                >
                    Already have an account? Sign in
                </Link>

                {/* <div className="py-2">
                    <p className="text-center text-xs text-muted-foreground">
                        By continuing, you acknowledge that you understand and agree to the{" "}

                        <a href="#" className="text-secondary-foreground hover:underline">
                            Terms & Conditions
                        </a>{" "}
                        and{" "}
                        <a href="#" className="text-secondary-foreground hover:underline">
                            Privacy Policy.
                        </a>
                    </p>
                </div> */}
            </div>
        </main>
    );
};

export default Page;
