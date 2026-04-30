import type { Metadata } from "next";
import { buildWebMetadata } from "../lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "Terms & Conditions",
  description: "Review the Daily Express terms and conditions.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Daily Express
        </p>
        <h1 className="text-3xl font-semibold text-neutral-950">
          Terms &amp; Conditions
        </h1>
      </div>
      <p className="text-sm leading-7 text-neutral-700">
        By using Daily Express, you agree to provide accurate account details,
        comply with trip booking rules, and use the platform lawfully. Drivers
        and passengers remain responsible for the information they provide and
        for meeting their obligations around scheduled trips and payments.
      </p>
    </main>
  );
}
