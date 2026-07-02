import type { Metadata } from "next";
import VehicleList from "~/components/vehicles/VehicleList";
import { buildDriverMetadata } from "~/lib/seo";

export const metadata: Metadata = buildDriverMetadata({
    title: "My Vehicles",
    description:
        "Manage your vehicles registered on Daily Express Driver.",
    path: "/vehicles",
    noIndex: true,
});

const VehiclesPage = () => {
    return <VehicleList />;
};

export default VehiclesPage;
