import type { Metadata } from "next";
import OnboardingForm from "~/components/onboarding/onboardingForm";
import { buildDriverMetadata } from "~/lib/seo";

export const metadata: Metadata = buildDriverMetadata({
  title: "Driver Sign Up",
  description:
    "Apply to join Daily Express Driver and create your route, payout, and profile details in one onboarding flow.",
  path: "/sign-up",
});

const Page = async () => {
  return (
    <div className="w-full bg-background p-6 mt-4">
      <div className="mx-auto max-w-7xl">
        <OnboardingForm />
      </div>
    </div>
  );
};

export default Page;
