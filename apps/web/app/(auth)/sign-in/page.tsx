import { buttonVariants } from "@repo/ui/components/button";
import Link from "next/link";
import LoginForm from "~/components/auth-form/Login";
import { buildAuthHref } from "~/lib/app-routing";

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) => {
  const { redirect } = await searchParams;

  return (
    <main className="flex pt-20 p-4 flex-col items-center justify-center lg:px-0">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:max-w-sm">
        <div className="flex flex-col justify-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm">Sign in to your account</p>
        </div>

        <LoginForm redirect={redirect} />

        <Link
          className={buttonVariants({
            variant: "link",
            className: "gap-1.5",
          })}
          href={buildAuthHref("/sign-up", redirect)}
        >
          Don&apos;t have an account? Sign up
        </Link>

        <div className="pt-2">
          <p className="text-center text-xs text-muted-foreground">
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
      </div>
    </main>
  );
};

export default Page;
