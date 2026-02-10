import OnboardingForm from "../../components/onboarding-form/onboardingForm"


const Page = async () => {
    return (
        <div className="w-full bg-background p-6 mt-4">
            <div className="mx-auto max-w-7xl">
                <OnboardingForm />
            </div>
        </div>
    )
}

export default Page