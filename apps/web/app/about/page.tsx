import type { Metadata } from "next";
import Footer from "@repo/ui/Footer";
import Navbar from "~/components/Navbar";
import { buildWebMetadata } from "../lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "About Us",
  description:
    "Learn how Daily Express is making intercity road travel easier to find, book, operate, and trust.",
  path: "/about",
});

const principles = [
  "People need to know where a trip starts, where it ends, when it leaves, what it costs, and who is operating it before they commit.",
  "Drivers need a better way to publish routes, fill seats, manage passengers, and get paid without chasing manual records.",
  "Every booking should move through a clear path: search, seat hold, payment, confirmation, trip status, and payout.",
  "Important travel and payment updates should be visible when they matter, not scattered across calls, chats, and guesswork.",
];

const differentiators = [
  {
    title: "Built around the trip",
    body: "Daily Express starts with the real journey: route, timing, seats, fare, meeting point, passenger, driver, and payment.",
  },
  {
    title: "Designed for trust",
    body: "Passengers and drivers get clear records for bookings, payments, trip activity, and payouts.",
  },
  {
    title: "From search to settlement",
    body: "The experience does not stop at discovery. It carries a trip from search through checkout, confirmation, completion, and driver earnings.",
  },
  {
    title: "Useful for operators",
    body: "Independent drivers and small transport businesses can manage routes digitally without building their own booking systems.",
  },
  {
    title: "Ready to grow",
    body: "The same foundation can support one driver, repeat corridors, busy fleets, and larger travel networks over time.",
  },
];

export default function AboutPage() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="bg-white sticky top-0 z-50">
        <Navbar />
      </div>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-20 px-4 py-20 md:px-8">
        {/* Hero */}
        <section className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight text-neutral-950 md:text-5xl">
            About Daily Express
          </h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Making road travel easier to book, operate, and trust
          </p>
          <p className="max-w-2xl pt-1 text-base leading-7 text-neutral-600">
            By giving passengers and drivers a clearer way to move between
            cities.
          </p>
        </section>

        {/* What We Do */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
            We&apos;re building the operating layer for intercity road travel
          </h2>
          <p className="max-w-2xl text-base leading-7 text-neutral-500">
            Road travel is how millions of people move between cities, but the
            experience is still harder than it should be. Passengers often have
            to ask around, call ahead, compare uncertain options, and hope the
            details are still true by the time they are ready to go.
          </p>
          <p className="max-w-2xl text-base leading-7 text-neutral-500">
            Drivers and transport operators face the other side of the same
            problem: finding passengers, keeping seat availability accurate,
            confirming payments, managing trip status, and knowing what has been
            earned.
          </p>
          <p className="max-w-2xl text-base leading-7 text-neutral-500">
            Daily Express brings those pieces into one marketplace. Passengers
            can search for available trips, compare route details, book seats,
            pay securely, and check booking status. Drivers can publish routes,
            manage passengers, close bookings when a trip is full or ready to
            depart, and receive payouts after completed trips.
          </p>
          <p className="max-w-2xl text-base leading-7 text-neutral-500">
            We are not just listing rides. We are building the trust layer
            around the whole trip so every booking has clearer information, a
            payment record, and a path from reservation to completion.
          </p>
        </section>

        {/* Why We Built It */}
        <section className="space-y-5">
          <div className="space-y-3">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
              Why we exist
            </h2>
            <p className="text-base leading-7 text-neutral-500">
              Intercity mobility is not just about getting from one place to
              another. It affects work, family, school, trade, events,
              healthcare, and the everyday movement of people across the
              country.
            </p>
          </div>
          <div className="flex flex-col gap-3.5">
            {principles.map((p) => (
              <p
                key={p}
                className="border-l-2 border-blue-600 pl-4 text-base leading-7 text-neutral-600"
              >
                {p}
              </p>
            ))}
          </div>
        </section>

        {/* Who We Serve */}
        <section className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
              Who We Serve
            </h2>
            <p className="max-w-2xl text-base leading-7 text-neutral-500">
              Daily Express serves the people and operators who keep intercity
              travel moving:
            </p>
          </div>
          <ul className="flex flex-col gap-2">
            {[
              "Passengers who want to compare road trips and reserve seats with confidence",
              "Drivers who want to turn regular routes into a more organized travel business",
              "Commuters and frequent travellers who depend on the same corridors repeatedly",
              "Small transport operators that need digital booking, payment, and passenger workflows",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-base leading-7 text-neutral-600"
              >
                <span className="mt-px select-none text-neutral-400">·</span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* What Makes Us Different */}
        <section className="space-y-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
              What Makes Us Different for Customers?
            </h2>
            <p className="text-base text-neutral-500">Daily Express is:</p>
          </div>
          <div className="flex flex-col gap-5">
            {differentiators.map((d) => (
              <div key={d.title}>
                <p className="text-[15px] font-semibold text-neutral-900">
                  {d.title}
                </p>
                <p className="text-base leading-6 text-neutral-500">{d.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Our Role */}
        <section className="space-y-3 border-t border-neutral-200 pt-10">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
            Our role
          </h2>
          <p className="max-w-2xl text-base leading-7 text-neutral-500">
            Daily Express provides the marketplace and operating system for
            search, booking, payment processing, route management, service
            updates, and driver payouts. Drivers remain responsible for the
            routes they publish and the trips they operate. Our job is to make
            the business of road travel clearer, more accountable, and easier to
            run.
          </p>
        </section>

        {/* Join Us */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
            Join Us?
          </h2>
          <p className="max-w-2xl text-base leading-7 text-neutral-500">
            We&apos;re looking for people who want to make intercity road travel
            work better for the passengers, drivers, and transport businesses
            that depend on it every day.
          </p>
          <p className="text-base leading-7 text-neutral-500">
            Send an email to{" "}
            <a
              href="mailto:support@dailyexpress.app"
              className="font-medium text-blue-600 underline underline-offset-4"
            >
              support@dailyexpress.app
            </a>
          </p>
          <p className="pt-1 text-base leading-7 text-neutral-400">
            Thank you for reading and being part of this community,
            <br />
            The Daily Express Team
          </p>
        </section>
      </main>

      <Footer className="max-w-7xl mx-auto w-full mt-auto" />
    </div>
  );
}
