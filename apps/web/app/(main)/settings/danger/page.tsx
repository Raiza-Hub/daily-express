import { DangerCard } from "~/components/user/DangerCard";

const DangerPage = () => (
    <main className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Danger zone
            </h1>
            <p className="text-sm text-muted-foreground">
                Irreversible actions for your account and driver profile.
            </p>
        </div>
        <DangerCard />
    </main>
);

export default DangerPage;
