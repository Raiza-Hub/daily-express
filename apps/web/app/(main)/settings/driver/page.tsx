import { DriverCard } from "~/components/driver/DriverCard";

const DriverPage = () => (
    <main className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Your driver profile
            </h1>
            <p className="text-sm text-muted-foreground">
                Manage your driver details.
            </p>
        </div>
        <DriverCard />
    </main>
);

export default DriverPage;