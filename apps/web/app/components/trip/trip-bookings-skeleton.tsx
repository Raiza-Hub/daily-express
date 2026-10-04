function TripBookingsSkeletonCard() {
  return (
    <div className="flex justify-center" aria-hidden>
      <div className="w-full overflow-hidden rounded-2xl bg-neutral-50 xl:max-w-sm dark:bg-neutral-900">
        <div className="h-60 w-full animate-pulse bg-neutral-200 dark:bg-neutral-800" />
        <div className="p-5">
          <div className="h-4 w-16 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-2 h-6 w-3/4 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
          <div className="my-4 h-px w-full bg-border" />
          <div className="flex items-center justify-between">
            <span className="h-4 w-14 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
            <span className="h-7 w-24 animate-pulse rounded-md bg-neutral-200 dark:bg-neutral-800" />
          </div>
        </div>
      </div>
    </div>
  );
}

function TripBookingsSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2, 3].map((index) => (
        <TripBookingsSkeletonCard key={index} />
      ))}
    </div>
  );
}

export { TripBookingsSkeleton };