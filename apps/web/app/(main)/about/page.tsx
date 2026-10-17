import type { Metadata } from "next";
import Link from "next/link";
import { SUPPORT_EMAIL } from "~/lib/brand";

export const metadata: Metadata = {
    title: "About Us",
    description: "Our mission is to take the uncertainty out of booking a ride.",
};

const heading = "text-4xl font-bold tracking-tight text-neutral-900 md:text-5xl";
const sectionHeading =
    "text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl";
const prose = "text-neutral-700 leading-[1.75] max-w-[58ch]";

const values = [
    {
        id: "certainty",
        title: "Certainty",
        body: (
            <>
                We believe a trip should go when you said it would. A booking is
                the whole vehicle: all four seats are yours, whether you fill
                them or not. Once it is paid for we go and look for a driver, and
                if none accepts in time the fare comes back automatically,
                without you having to ask.
            </>
        ),
    },
    {
        id: "clarity",
        title: "Clarity",
        body: (
            <>
                We believe the price you see is the price you pay. A booking is
                the whole vehicle, so you pay for all four seats and four service
                fees, with a luggage charge only when someone is travelling with
                luggage. The total is on the screen before you confirm, and
                nothing is added afterwards.
            </>
        ),
    },
    {
        id: "fairness",
        title: "Fairness",
        body: (
            <>
                We believe the person who did the work keeps the fare. Drivers
                prove their identity and their bank account before they can take
                a trip, and they are paid for every trip they complete.
                Passengers pay what was shown to them.
            </>
        ),
    },
    {
        id: "discretion",
        title: "Discretion",
        body: (
            <>
                We believe your details are yours. We collect only what a trip
                needs, you enter your payment details on Kora&rsquo;s own
                checkout page where we never see them, and we do not sell your
                information to anyone, for any purpose.
            </>
        ),
    },
];

const steps = [
    "Choose where you are going, the date, and one of the published departure times.",
    "Name the passengers travelling — at least one, up to four. Each one needs a full name, an email address and a phone number.",
    "Pay. The total was already on the screen.",
    "We look for a verified driver as soon as your booking is paid for.",
    "The trip leaves, or your fare comes back.",
];

const AboutPage = () => (
    <div className="w-full py-8 md:py-12">
        <div className="mx-auto w-full max-w-[62rem]">
            <section className="pb-10 md:pb-14">
                <h1 className={heading}>About Us</h1>
                <p className="mt-8 text-2xl leading-snug font-semibold text-neutral-900 md:text-3xl">
                    Our mission is to take the uncertainty out of booking a ride.
                </p>
            </section>

            <section className="border-t border-neutral-100 py-10 md:py-14">
                <h2 className={sectionHeading}>What we believe</h2>
                <div className="mt-12 grid gap-12 md:grid-cols-2">
                    {values.map((value) => (
                        <div key={value.id}>
                            <h3 className="text-xl font-semibold tracking-tight text-neutral-900">
                                {value.title}
                            </h3>
                            <p className={`${prose} mt-4`}>{value.body}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="border-t border-neutral-100 py-10 md:py-14">
                <h2 className={sectionHeading}>How a ride comes together</h2>
                <ol className="mt-12 space-y-8">
                    {steps.map((step, index) => (
                        <li key={step} className="flex gap-5">
                            <span
                                aria-hidden
                                className="tabular-nums w-7 shrink-0 text-base font-semibold text-neutral-400"
                            >
                                {index + 1}
                            </span>
                            <p className="text-lg leading-[1.7] text-neutral-700">
                                {step}
                            </p>
                        </li>
                    ))}
                </ol>
            </section>

            <section className="border-t border-neutral-100 py-10 md:py-14">
                <h2 className={sectionHeading}>Who it&rsquo;s for</h2>
                <div className="mt-12 grid gap-10 md:grid-cols-2">
                    <div>
                        <h3 className="text-xl font-semibold tracking-tight text-neutral-900">
                            Travelling together, or on your own
                        </h3>
                        <p className={`${prose} mt-4`}>
                            Book the whole vehicle for a departure on one of our
                            routes. The price is set before you start, and the
                            trip runs once a driver is confirmed.
                        </p>
                        <Link
                            href="/trip/new"
                            className="mt-6 inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
                        >
                            Book a ride
                        </Link>
                    </div>
                    <div>
                        <h3 className="text-xl font-semibold tracking-tight text-neutral-900">
                            Drivers who want steady work
                        </h3>
                        <p className={`${prose} mt-4`}>
                            Verify your identity and your bank account once, and
                            we will call you when a trip near you needs a
                            driver. You are paid for every trip you complete.
                        </p>
                        <Link
                            href="/driver/signup"
                            className="mt-6 inline-flex items-center justify-center rounded-full border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50"
                        >
                            Drive with us
                        </Link>
                    </div>
                </div>
            </section>

            <section className="border-t border-neutral-100 pt-10 pb-4 md:pt-14">
                <h2 className={sectionHeading}>Join us?</h2>
                <p className={`${prose} mt-8`}>
                    We are a small team building for roads in Nigeria, and we
                    have a lot left to get right. If the problems on this page
                    are the kind you want to work on, we would like to hear from
                    you.
                </p>
                <p className="mt-8">
                    <a
                        href={`mailto:${SUPPORT_EMAIL}?subject=Joining%20the%20Daily%20Express%20team`}
                        className="text-neutral-900 underline underline-offset-4 transition-colors hover:text-neutral-600"
                    >
                        {SUPPORT_EMAIL}
                    </a>
                </p>
            </section>
        </div>
    </div>
);

export default AboutPage;
