import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center justify-center gap-5 px-6 text-center">
      <Image
        src="/not-found-duck3.jpg"
        alt=""
        width={480}
        height={404}
        className="h-auto w-80 sm:w-96"
      />
      <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-50">
        Sorry, we couldn&apos;t find that page
      </h2>
      <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        The link may be broken, or the page may have moved. Check the address
        or head back to the homepage.
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