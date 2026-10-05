import { DangerCard } from "~/components/user/DangerCard";
import { getDriverProfileState } from "~/lib/driver-session";

const DangerPage = async () => {
    const canDeactivate = (await getDriverProfileState()) === "active";

    return (
        <main className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                    Danger zone
                </h1>
                <p className="text-sm text-muted-foreground">
                    Irreversible actions for your account and driver profile.
                </p>
            </div>
            <DangerCard canDeactivate={canDeactivate} />
        </main>
    );
};

export default DangerPage;
