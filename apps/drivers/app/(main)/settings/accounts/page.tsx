import type { Metadata } from "next";
import DriverInfo from "~/components/settings/DriverInfo";
import { buildDriverMetadata } from "~/lib/seo";

export const metadata: Metadata = buildDriverMetadata({
    title: "Account Settings",
    description:
        "Manage your Daily Express Driver account information and operating preferences.",
    path: "/settings/accounts",
    noIndex: true,
});


const Page = async () => {
    return (
        <DriverInfo />
    );
};

export default Page;
