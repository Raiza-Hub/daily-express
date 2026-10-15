"use client";

import Link from "next/link";
import { LegalDocument, type LegalClause } from "~/components/legal/LegalDocument";
import { LegalNavbar } from "~/components/legal/LegalNavbar";
import { LEGAL_ENTITY_NAME } from "~/lib/brand";

const clauses: LegalClause[] = [
    {
        id: "who-we-are",
        title: "Who we are",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Daily Express LTD (&ldquo;Daily Express&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is the company that runs the Daily Express app. We are registered in the Federal Republic of Nigeria with registration number 9605872, and we are the data controller for the information described in this policy.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        This policy covers the app and everything you do in it, whether you are booking and travelling as a passenger or signing up to drive. Where a passenger books travel for other people, we also handle those other people&rsquo;s details on their behalf, and their rights come through you.
                    </>
                ),
            },
        ],
    },
    {
        id: "what-we-collect",
        title: "What we collect",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        We collect what we need to run the service: enough to identify you, take your payment, get you onto the right bus, and pay the right driver. We do not collect what we do not need.
                    </>
                ),
            },
            {
                kind: "table",
                head: ["Information", "Where it comes from", "Why we hold it"],
                rows: [
                    [
                        "Full name, email address, profile picture",
                        "Google, when you sign in",
                        "To identify your account and contact you about your bookings",
                    ],
                    [
                        "Date of birth, phone number, gender",
                        "You, when you complete your profile",
                        "To confirm you meet the minimum age, to reach you about a trip, and for driver matching",
                    ],
                    [
                        "Trip and booking details: departure point, destination, date, departure time, number of passengers",
                        "You, when you book",
                        "To run the trip and give you and the driver the right information",
                    ],
                    [
                        "Passenger details: full name, email address, phone number, luggage",
                        "You, for each person you book for",
                        "To confirm each passenger and to give the driver a manifest for the trip",
                    ],
                    [
                        "Payment records: amount, currency, payment reference, and the payer&rsquo;s bank name, account number and account name returned by the payment provider",
                        "Kora, when you pay",
                        "To confirm payment, issue refunds and answer payment questions",
                    ],
                    [
                        "Driver details: address, bank account details, verification status",
                        "You, when you apply to drive",
                        "To verify you, pay you, and match you to nearby departures",
                    ],
                    [
                        "Identity verification: a scrambled (hashed) fingerprint of the BVN or NIN you give, and the result of that check",
                        "You, and the identity service that checks it",
                        "To confirm you are who you say you are before you drive. We keep only the hashed fingerprint, never the raw BVN or NIN itself",
                    ],
                    [
                        "Call records: when we rang you about a trip, whether you answered, accepted or declined",
                        "Our dispatch system",
                        "To assign trips and to keep dispatch fair across drivers",
                    ],
                    [
                        "Technical logs: your account ID, the actions you take, and error details",
                        "Our systems, when you use the app",
                        "To keep the service secure, apply rate limits and fix faults. We do not store IP addresses in our own database, though our error-monitoring provider may record the IP address your request came from",
                    ],
                ],
            },
        ],
    },
    {
        id: "what-we-do-not-collect",
        title: "What we never collect",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        These are the things people reasonably worry about, so we will say plainly that we do not do them:
                    </>
                ),
            },
            {
                kind: "list",
                items: [
                    <>
                        We never see or store your card details or your bank login credentials. You enter those on Kora&rsquo;s own checkout. When a payment succeeds, the bank account number and account name Kora returns are kept with the payment record, so a refund can go back to the same account.
                    </>,
                    <>
                        We do not use advertising or marketing trackers, and we do not build advertising profiles of you.
                    </>,
                    <>
                        We do not track your location in the background, and the app does not ask for it.
                    </>,
                    <>
                        We do not sell your data, and we do not rent it out.
                    </>,
                ],
            },
        ],
    },
    {
        id: "how-we-use-it",
        title: "How we use your information",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        We use your information only for the purposes below, and we rely on one of three lawful bases for each: performing the contract you enter into with us, meeting a legal obligation we are under, or our legitimate interest in running a safe, working transport service. Where we rely on legitimate interests, you can ask us what they are.
                    </>
                ),
            },
            {
                kind: "terms",
                items: [
                    {
                        term: "Running your booking",
                        detail:
                            "Holding your booking and payment details, confirming your trip, giving you and your driver the right information, and processing a refund if the trip is cancelled.",
                    },
                    {
                        term: "Verifying and paying drivers",
                        detail:
                            "Checking a driver's bank account and identity before they take trips, matching drivers to nearby departures, and transferring what they have earned to their bank account.",
                    },
                    {
                        term: "Contacting you",
                        detail:
                            "Sending booking confirmations, trip notices, refund outcomes, and, if you drive, notices about your trips and what you have been paid.",
                    },
                    {
                        term: "Keeping the service safe",
                        detail:
                            "Applying rate limits, preventing fraud and abuse, and investigating complaints or safety incidents.",
                    },
                    {
                        term: "Meeting legal duties",
                        detail:
                            "Keeping records we are required to keep under Nigerian law, and responding to lawful requests from the authorities.",
                    },
                ],
            },
        ],
    },
    {
        id: "sharing",
        title: "Who we share it with",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        We share the minimum each service provider needs to do its job. Here is the whole list.
                    </>
                ),
            },
            {
                kind: "table",
                head: ["Provider", "What they receive", "What they do"],
                rows: [
                    [
                        "Kora",
                        "Your email address and the amount you pay; a driver&rsquo;s name and bank account details to pay them; and a driver&rsquo;s BVN or NIN to verify their identity",
                        "Takes payments, verifies driver bank accounts and identities, and pays drivers",
                    ],
                    [
                        "Google",
                        "Your sign-in request",
                        "Signs you in and shares your name, email and profile picture",
                    ],
                    [
                        "Africa&rsquo;s Talking",
                        "Your phone number and the details of the trip being offered",
                        "Places the automated call we use to ask drivers to accept a trip",
                    ],
                    [
                        "Amazon SES",
                        "Your email address and the contents of the email",
                        "Delivers booking, refund and payout emails",
                    ],
                    [
                        "Cloudflare",
                        "Driver profile photos",
                        "Stores the profile photo a driver uploads so it can be shown in the app",
                    ],
                    [
                        "Upstash",
                        "Your account ID (not your IP address)",
                        "Applies rate limits to booking and driver actions",
                    ],
                    [
                        "Sentry",
                        "Error reports and technical logs, which include your account ID and may include the IP address your request came from",
                        "Alerts us to faults and performance problems so we can fix them",
                    ],
                    [
                        "Railway",
                        "Everything described in this policy",
                        "Hosts the database our app runs on",
                    ],
                    [
                        "Appsmith",
                        "Aggregated operational data",
                        "Powers our internal admin panel, which is not open to the public",
                    ],
                ],
            },
            {
                kind: "p",
                text: (
                    <>
                        We also disclose information where the law requires it, for example to a court, a regulator or the police, and where a passenger&rsquo;s safety or a driver&rsquo;s safety is at risk. We do not sell your information to anyone, for any purpose.
                    </>
                ),
            },
        ],
    },
    {
        id: "automated-decisions",
        title: "Automated decisions",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Some decisions in the app are made by a computer rather than by a person reading your application. We would rather you knew:
                    </>
                ),
            },
            {
                kind: "list",
                items: [
                    <>
                        <span className="font-medium text-neutral-900">Which drivers get offered a trip.</span>{" "}
                        When a departure needs a driver, our system scores the eligible drivers nearby and works down the list. The score blends how recently they were last called, how often they accepted when called, and how many of their trips they completed or cancelled. A driver with no track record starts on a neutral score rather than a penalty. Declining a call does not remove you or lower your score; not answering because your phone was off does not count against you either.
                    </>,
                    <>
                        <span className="font-medium text-neutral-900">Whether a seat is still available.</span>{" "}
                        A departure closes automatically once it has four passengers booked.
                    </>,
                    <>
                        <span className="font-medium text-neutral-900">Whether a slot has departed.</span>{" "}
                        Bookings close automatically at the scheduled departure time.
                    </>,
                ],
            },
            {
                kind: "p",
                text: (
                    <>
                        You can ask us to explain or review any decision that has a significant effect on you, and we will do it on a human basis. Contact us and we will arrange it.
                    </>
                ),
            },
        ],
    },
    {
        id: "cookies",
        title: "Cookies",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        We use two cookies, both strictly necessary to keep you signed in. There are no advertising, analytics or tracking cookies on this site.
                    </>
                ),
            },
            {
                kind: "terms",
                items: [
                    {
                        term: "token",
                        detail:
                            "Keeps you signed in for your session. Expires quickly and is replaced automatically so that a stolen copy is short-lived.",
                    },
                    {
                        term: "refreshToken",
                        detail:
                            "Signs you back in so you are not asked for Google every time. Lasts up to seven days.",
                    },
                ],
            },
            {
                kind: "p",
                text: (
                    <>
                        Both are set as HTTP-only, so scripts in your browser cannot read them, and they are marked Secure in production. You clear them by signing out or clearing your browser&rsquo;s cookies.
                    </>
                ),
            },
        ],
    },
    {
        id: "sharing-between-users",
        title: "Details shared between passengers and drivers",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        A booking only works if the driver knows who is on board. So, for a confirmed trip:
                    </>
                ),
            },
            {
                kind: "list",
                items: [
                    <>
                        The assigned driver sees each passenger&rsquo;s full name, email address, phone number, and whether they are bringing luggage.
                    </>,
                    <>
                        You see the trip&rsquo;s departure point, destination, date, departure time, and who else you booked for.
                    </>,
                    <>
                        Drivers assigned to the same trip can see the trip&rsquo;s passenger list. Passengers cannot see one another&rsquo;s details, and drivers cannot see a passenger&rsquo;s details for trips they are not driving.
                    </>,
                ],
            },
        ],
    },
    {
        id: "retention",
        title: "How long we keep it",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        We keep your information for as long as your account is active, and then for as long as the law requires us to keep it. Records that have to exist for tax, regulatory or dispute purposes are kept for the period Nigerian law sets out, and are not used for anything else.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        When we no longer need to keep something, we delete it or replace it with something anonymous so it can no longer be traced back to you.
                    </>
                ),
            },
        ],
    },
    {
        id: "your-rights",
        title: "Your rights",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Under the Nigeria Data Protection Act, you have the right to:
                    </>
                ),
            },
            {
                kind: "list",
                items: [
                    <>know what we hold about you, and get a copy of it;</>,
                    <>
                        have anything inaccurate corrected. You can do most of this
                        yourself from{" "}
                        <Link
                            href="/settings/profile"
                            className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                        >
                            Settings
                        </Link>
                        {";"}
                    </>,
                    <>ask us to delete your data, or to stop using it;</>,
                    <>withdraw a consent you gave us, where our use of your data depends on it;</>,
                    <>object to a use of your data based on legitimate interests;</>,
                    <>ask us to correct a record that is wrong, or to complete a record that is missing;</>,
                    <>
                        complain to the Nigeria Data Protection Commission if you think we have handled your data badly.
                    </>,
                ],
            },
            {
                kind: "p",
                text: (
                    <>
                        We do not charge for making a request, and we aim to answer within thirty days. We may ask you to confirm your identity first so we do not hand your data to the wrong person.
                    </>
                ),
            },
        ],
    },
    {
        id: "deleting-your-account",
        title: "Deleting your account",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        You can delete your account at any time from{" "}
                        <Link
                            href="/settings/danger"
                            className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                        >
                            Settings &rarr; Delete account
                        </Link>
                        . We will ask you to type your email address to confirm, because deletion cannot be undone.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        When you delete your account we sign you out, deactivate any driver profile, remove your link to Google, and replace your identifying details with anonymous placeholders so that historic financial records stay intact and auditable without still holding your identity. We cannot delete your account while you have trips booked and paid for that have not yet run.
                    </>
                ),
            },
        ],
    },
    {
        id: "security",
        title: "How we protect it",
        blocks: [
            {
                kind: "list",
                items: [
                    <>Sign-in cookies are HTTP-only and Secure in production, and session tokens expire quickly.</>,
                    <>Passwords are not the issue here. We never hold your Google password.</>,
                    <>Payment credentials never reach our servers; they are handled by Kora&rsquo;s checkout.</>,
                    <>Access to internal systems, including the admin panel, is authenticated and signature-checked.</>,
                    <>Rate limits protect the booking and driver endpoints from abuse.</>,
                ],
            },
            {
                kind: "p",
                text: (
                    <>
                        No system is perfect. If a breach affects your information we will tell you and the Nigeria Data Protection Commission as the law requires.
                    </>
                ),
            },
        ],
    },
    {
        id: "transfers",
        title: "Where your data is processed",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Some of our providers process data on servers outside Nigeria. Where they do, the transfer is under the arrangements the Nigeria Data Protection Act requires, so that your information is protected to a standard no lower than it is here.
                    </>
                ),
            },
        ],
    },
    {
        id: "children",
        title: "Children",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        You must be at least 14 years old to hold an account, and we do not knowingly collect information from anyone younger. If you believe a child has given us information, contact us, and we will close the account and remove their personal details from our live systems, keeping only the records Nigerian law requires us to retain.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        If you book travel for a child, you are the one giving us their details, and you are responsible for it.
                    </>
                ),
            },
        ],
    },
    {
        id: "changes",
        title: "Changes to this policy",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        We may update this policy. When we do, we will change the date at the top of the page and, for any change that materially affects you, tell you in the app before it takes effect.
                    </>
                ),
            },
        ],
    },
    {
        id: "complaints",
        title: "Complaints",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        If you are unhappy with how we have handled your data, tell us first. Write to us and we will investigate and come back to you.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        If you are still not satisfied, you can complain to the Nigeria Data Protection Commission.
                    </>
                ),
            },
        ],
    },
];

const PrivacyPage = () => (
    <>
        <LegalNavbar />
        <main className="mx-auto w-full max-w-[62rem] px-4 py-10 sm:px-6 md:py-16">
            <LegalDocument
                title="Privacy Policy"
                clauses={clauses}
                sibling={{
                    href: "/terms",
                    label: "Terms of Use",
                    prompt:
                        "This document covers your data. For the rules that govern booking, paying and driving, read the",
                }}
                closing={
                    <>
                        Questions about this policy can go to the data controller, {LEGAL_ENTITY_NAME}. The
                        deal between you and us is set out in our{" "}
                        <Link
                            href="/terms"
                            className="text-neutral-900 underline decoration-neutral-400 underline-offset-4 transition-colors hover:decoration-neutral-900"
                        >
                            Terms of Use
                        </Link>
                        .
                    </>
                }
            />
        </main>
    </>
);

export default PrivacyPage;