import NewTripBooking from "~/components/trip/new-trip-booking";

export default function TripNewPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-10 py-8">
      <div>
        <h1 className="my-4 text-3xl font-semibold text-center tracking-tight text-neutral-900">
          Book a trip
        </h1>
      </div>
      <NewTripBooking />
    </div>
  );
}