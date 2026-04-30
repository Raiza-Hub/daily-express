import type { Metadata } from "next";
import PayoutTable from "~/components/PayoutTable";
import { buildDriverMetadata } from "~/lib/seo";

export const metadata: Metadata = buildDriverMetadata({
    title: "Payouts",
    description:
        "Track Daily Express Driver payout history, transfer status, and settlement details.",
    path: "/payouts",
    noIndex: true,
});

const PayoutsPage = async () => {

    return (
        <PayoutTable />
    );
};

export default PayoutsPage;
