import type { Metadata } from "next";
import DriverRoutesPage from "~/components/route/DriverRoutesPage";
import { buildDriverRoutesMetadata } from "~/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  return buildDriverRoutesMetadata();
}

const RoutesPage = () => {
  return <DriverRoutesPage />;
};

export default RoutesPage;
