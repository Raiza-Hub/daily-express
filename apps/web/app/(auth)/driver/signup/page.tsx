import { redirect } from "next/navigation";
import { AuthLogo } from "~/components/auth/AuthLogo";
import { DriverSignupForm } from "~/components/driver/DriverSignupForm";
import { getDriverProfileState } from "~/lib/driver-session";

const DriverSignupPage = async () => {
    const state = await getDriverProfileState();

    if (state === "deactivated") {
        redirect("/driver/deactivated");
    }

    if (state === "active") {
        redirect("/settings/driver");
    }

    return (
        <main className="flex flex-col items-center px-4 pt-10 pb-16">
            <div className="flex w-full max-w-sm flex-col space-y-6">
                <div className="flex flex-col items-center space-y-2 text-center">
                    <AuthLogo />
                    <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        Join Beckōn as a driver
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Complete your profile to start accepting bookings.
                    </p>
                </div>
                <DriverSignupForm />
            </div>
        </main>
    );
};

export default DriverSignupPage;