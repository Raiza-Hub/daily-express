import type { Metadata } from "next";
import Profile from "~/components/settings/Profile";
import { buildDriverMetadata } from "~/lib/seo";

export const metadata: Metadata = buildDriverMetadata({
    title: "Profile Settings",
    description:
        "Manage your Daily Express Driver profile information and account details.",
    path: "/settings/profile",
    noIndex: true,
});


const Page = async () => {
    return (
        <Profile />
    );
};

export default Page;
