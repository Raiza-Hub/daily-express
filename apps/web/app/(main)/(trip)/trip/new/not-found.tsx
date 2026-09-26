import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 py-12 text-center">
      <Image
        src="/not-found.webp"
        alt="Not found"
        width={480}
        height={360}
        className="h-auto w-80 sm:w-96"
      />
      <h2 className="text-xl font-semibold text-neutral-900">
        No trips available
      </h2>
      <p className="max-w-sm text-sm text-neutral-500">
        We couldn&apos;t find this origin. Please book from an available origin.
      </p>
      <Link
        href="/trip/new"
        className="text-sm font-medium text-neutral-900 underline underline-offset-4"
      >
        Return to trips
      </Link>
    </div>
  );
}
