import type { Metadata } from "next";
import Link from "next/link";
import FaqSection from "~/components/FaqSection";
import HowItWorksSection from "~/components/HowItWorksSection";

export const metadata: Metadata = {
  title: { absolute: "Beckōn" },
};

export default function Home() {
  return (
    <div className="w-full">
      <section className="flex flex-col items-center text-center py-16 md:py-28">
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          Your ride, at your beck and call.
        </h1>
        <p className="text-neutral-500 text-lg max-w-xl mb-8">
          Book your next ride in seconds. Fast, reliable, and always at your
          command.
        </p>
        <Link
          href="/trip/new"
          className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-8 py-3 text-base font-semibold text-white transition-colors hover:bg-neutral-800"
        >
          Book a Trip
        </Link>
      </section>

      <div className="bg-background w-full">
        <section
          id="how-it-works"
          className="py-28 max-w-7xl mx-auto scroll-mt-16"
        >
          <HowItWorksSection />
        </section>
      </div>

      <div id="faq" className="scroll-mt-16">
        <FaqSection className="py-16 md:py-28" />
      </div>
    </div>
  );
}