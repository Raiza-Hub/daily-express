import type { Metadata } from "next";
import Profile from "~/components/setting/Profile";
import { buildWebMetadata } from "../../../lib/seo";

export const metadata: Metadata = buildWebMetadata({
    title: "Profile Settings",
    description:
        "Manage your Daily Express profile details and account preferences.",
    path: "/settings/profile",
    noIndex: true,
});



const Page = async () => {
    return (
        <Profile />
    );
};

export default Page;
