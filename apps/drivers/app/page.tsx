import Image, { type ImageProps } from "next/image";
import { Button, buttonVariants } from "@repo/ui/components/button";
import OnboardingForm from "./components/onboarding-form/onboardingForm";


export default function Home() {
  return (
    <div className="">
      <div className="mx-auto max-w-7xl">
        <OnboardingForm />
      </div>
    </div>
  );
}
