import OnboardingForm from "~/components/auth-form/Onboarding";

const Page = () => {
  return (
    <main className="flex pt-20 p-4 flex-col items-center justify-center lg:px-0">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:max-w-sm">
        <div className="flex flex-col justify-center space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Complete your profile
          </h1>
          <p className="text-sm">
            Tell us a little more about yourself to get started.
          </p>
        </div>

        <OnboardingForm />
      </div>
    </main>
  );
};

export default Page;