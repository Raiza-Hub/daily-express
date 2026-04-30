import type { Metadata } from "next";
import { buildWebMetadata } from "../lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "Privacy Policy",
  description:
    "Learn how Daily Express handles personal data and trip information.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-16">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
          Daily Express
        </p>
        <h1 className="text-3xl font-semibold text-neutral-950">
          Privacy Policy
        </h1>
      </div>
      <p className="text-sm leading-7 text-neutral-700">
        Daily Express stores the account, trip, and payment data needed to run
        bookings, support payouts, and improve the product. We limit access to
        this information to the systems and operators required to provide the
        service.
      </p>
    </main>
  );
}
