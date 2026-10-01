import { redirect } from "next/navigation";
import { EventCalendarSection } from "~/components/EventCalendarSection";
import { getDriverProfile } from "~/lib/driver-session";

export default async function DriverCalendarPage() {
  const driver = await getDriverProfile();

  if (!driver) {
    redirect("/driver/signup");
  }

  return <EventCalendarSection />;
}