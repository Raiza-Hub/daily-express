function NewTripBookingSkeleton() {
  return (
    <div className="flex w-full flex-col gap-10">
      <div>
        <p className="h-6 w-24 animate-pulse rounded-md bg-neutral-200" />
        <div className="mt-4 flex gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 w-16 animate-pulse rounded-2xl bg-neutral-200"
            />
          ))}
        </div>
      </div>

      <div className="max-w-md">
        <p className="h-6 w-16 animate-pulse rounded-md bg-neutral-200" />
        <div className="mt-4 h-12 w-full animate-pulse rounded-full bg-neutral-200" />
      </div>

      <div className="max-w-md">
        <p className="h-6 w-28 animate-pulse rounded-md bg-neutral-200" />
        <div className="mt-4 h-12 w-full animate-pulse rounded-full bg-neutral-200" />
      </div>

      <div>
        <p className="h-6 w-32 animate-pulse rounded-md bg-neutral-200" />
        <div className="mt-4 flex flex-wrap gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-9 w-24 animate-pulse rounded-full bg-neutral-200"
            />
          ))}
        </div>
      </div>

      <div className="max-w-md">
        <p className="h-6 w-28 animate-pulse rounded-md bg-neutral-200" />
        <div className="mt-2 h-4 w-3/4 animate-pulse rounded-md bg-neutral-200" />
      </div>

      <div className="max-w-md">
        <p className="h-6 w-24 animate-pulse rounded-md bg-neutral-200" />
        <div className="mt-2 h-4 w-full animate-pulse rounded-md bg-neutral-200" />
        <div className="mt-4 h-12 w-full animate-pulse rounded-full bg-neutral-200" />
      </div>

      <div>
        <p className="h-8 w-20 animate-pulse rounded-md bg-neutral-200" />
        <div className="mt-4 flex items-center justify-between">
          <span className="h-5 w-16 animate-pulse rounded-md bg-neutral-200" />
          <span className="h-8 w-24 animate-pulse rounded-md bg-neutral-200" />
        </div>
        <div
          className="mt-1 flex items-center justify-between"
          aria-hidden
        >
          <span className="h-4 w-24 animate-pulse rounded-md bg-neutral-200" />
          <span className="h-4 w-16 animate-pulse rounded-md bg-neutral-200" />
        </div>
        <div className="mt-5 h-12 w-full animate-pulse rounded-full bg-neutral-200" />
      </div>
    </div>
  );
}

export default NewTripBookingSkeleton;