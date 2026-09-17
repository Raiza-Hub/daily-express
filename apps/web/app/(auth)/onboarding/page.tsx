import OnboardingForm from "~/components/auth/OnboardingForm";

const Page = () => {
    return (
        <main className="flex flex-col items-center px-4 pt-10 pb-16">
            <div className="flex w-full max-w-sm flex-col space-y-6">
                <div className="flex flex-col items-center space-y-2 text-center">
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Complete your profile
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        We just need a couple more details.
                    </p>
                </div>

                <OnboardingForm />
            </div>
        </main>
    );
};

export default Page;