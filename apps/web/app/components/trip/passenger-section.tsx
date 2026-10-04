import { type TripPassenger } from "@repo/api";
import { PassengerListItem } from "./passenger-list-item";

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
  heading = "Passengers",
  emptyLabel = "No passengers on this trip.",
}: {
  passengers: TripPassenger[];
  isPending: boolean;
  isError: boolean;
  heading?: string;
  emptyLabel?: string;
}) {
  return (
    <div>
      <p className="mb-3 text-base font-semibold text-foreground">{heading}</p>
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
            <PassengerListItem key={passenger.id} passenger={passenger} />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </div>
  );
}

export { PassengerSkeletonRow, PassengerSection };