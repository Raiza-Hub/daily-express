import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 px-6 py-12 text-center">
      <Image
        src="/not-found.webp"
        alt=""
        width={480}
        height={360}
        className="h-auto w-80 sm:w-96"
      />
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        We couldn&apos;t find that page
      </h2>
      <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        The link may be broken, or the trip you&apos;re looking for is no longer
        available. Check the address or head back to the homepage.
      </p>
      <Link
        href="/"
        className="text-sm font-medium text-neutral-900 underline underline-offset-4 dark:text-neutral-50"
      >
        Return to homepage
      </Link>
    </div>
  );
}