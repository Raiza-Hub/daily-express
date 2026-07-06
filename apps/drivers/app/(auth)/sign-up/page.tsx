import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import OnboardingForm from "~/components/onboarding/onboardingForm";
import { buildDriverMetadata } from "~/lib/seo";

export const metadata: Metadata = buildDriverMetadata({
  title: "Driver Sign Up",
  description:
    "Apply to join Daily Express Driver and create your route, payout, and profile details in one onboarding flow.",
  path: "/sign-up",
});

const Page = async () => {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  const refreshToken = cookieStore.get("refreshToken")?.value;

  if (token || refreshToken) {
    const cookieHeader = [
      token ? `token=${token}` : null,
      refreshToken ? `refreshToken=${refreshToken}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    const apiUrl =
      process.env.NEXT_PUBLIC_DAILYEXPRESS_API_URL || "http://localhost:8000";

    let shouldRedirect = false;
    try {
      const res = await fetch(`${apiUrl}/api/v1/driver/profile`, {
        headers: { cookie: cookieHeader },
        cache: "no-store",
      });
      if (res.ok) {
        const body = await res.json();
        shouldRedirect = Boolean(body?.data);
      }
    } catch {
      // API unreachable — render the form; client-side query handles it
    }
    if (shouldRedirect) redirect("/");
  }

  return (
    <div className="w-full bg-background p-6 mt-4">
      <div className="mx-auto max-w-7xl">
        <OnboardingForm />
      </div>
    </div>
  );
};

export default Page;
