import { type TripPassenger } from "@repo/api";
import { PassengerListItem } from "./passenger-list-item";
import { maskEmail } from "~/lib/trip-bookings";

function PassengerSkeletonRow() {
  return (
    <li
      aria-hidden
      className="h-[62px] animate-pulse rounded-xl border border-neutral-200 bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-900"
    />
  );
}

function PassengerSection({
  passengers,
  isPending,
  isError,
}: {
  passengers: TripPassenger[];
  isPending: boolean;
  isError: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-base font-semibold text-foreground">
        Passengers
      </p>
      {isPending ? (
        <ul className="flex flex-col gap-3">
          <PassengerSkeletonRow />
          <PassengerSkeletonRow />
        </ul>
      ) : isError ? (
        <p className="text-sm text-muted-foreground">
          We couldn&rsquo;t load the passenger list.
        </p>
      ) : passengers.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {passengers.map((passenger) => (
            <PassengerListItem
              key={passenger.id}
              passenger={{ ...passenger, email: maskEmail(passenger.email) }}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No passengers on this trip.
        </p>
      )}
    </div>
  );
}

export { PassengerSkeletonRow, PassengerSection };