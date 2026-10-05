import { redirect } from "next/navigation";
import { EventCalendarSection } from "~/components/EventCalendarSection";
import { getDriverProfileState } from "~/lib/driver-session";

interface DriverCalendarPageProps {
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DriverCalendarPage({
  searchParams,
}: DriverCalendarPageProps) {
  const state = await getDriverProfileState();

  if (state === "deactivated") {
    redirect("/driver/deactivated");
  }

  if (state !== "active") {
    redirect("/driver/signup");
  }

  const { from, to } = await searchParams;

  return <EventCalendarSection from={first(from)} to={first(to)} />;
}
