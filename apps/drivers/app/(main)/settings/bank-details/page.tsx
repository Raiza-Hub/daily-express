import type { Metadata } from "next";
import PayoutSettings from "~/components/settings/PayoutSettings";
import { buildDriverMetadata } from "~/lib/seo";

export const metadata: Metadata = buildDriverMetadata({
    title: "Bank Details",
    description:
        "Update Daily Express Driver payout bank details and verification status.",
    path: "/settings/bank-details",
    noIndex: true,
});



const Page = async () => {
    return (
        <PayoutSettings />
    );
};

export default Page;
