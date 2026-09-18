import { ProfileCard } from "~/components/user/ProfileCard";

const ProfilePage = () => (
    <main className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Your profile
            </h1>
            <p className="text-sm text-muted-foreground">
                Manage your account details.
            </p>
        </div>
        <ProfileCard />
    </main>
);

export default ProfilePage;
