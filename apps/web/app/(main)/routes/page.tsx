import type { Metadata } from "next";
import { notFound } from "next/navigation";
import TripSearchSection from "~/components/trip/TripSearchSection";
import { buildWebMetadata } from "~/lib/seo";

type RoutesPageProps = {
  searchParams: Promise<{ origin?: string; date?: string }>;
};

export async function generateMetadata({
  searchParams,
}: RoutesPageProps): Promise<Metadata> {
  const { origin } = await searchParams;
  if (!origin) notFound();
  return buildWebMetadata({ title: `Routes from ${origin}`, path: "/routes" });
}

const RoutesPage = async ({ searchParams }: RoutesPageProps) => {
  const { origin, date } = await searchParams;
  if (!origin || !date) notFound();

  return (
    <div className="w-full max-w-7xl mx-auto">
      <TripSearchSection initialOrigin={origin} initialDate={date} />
    </div>
  );
};

export default RoutesPage;