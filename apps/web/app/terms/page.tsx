"use client";

import { LegalDocument, type LegalClause } from "~/components/legal/LegalDocument";
import { LegalNavbar } from "~/components/legal/LegalNavbar";

const clauses: LegalClause[] = [
    {
        id: "who-we-are",
        title: "Who we are",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Daily Express LTD (&ldquo;Daily Express&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) is a company registered in the Federal Republic of Nigeria with registration number 9605872. We operate an app that lets you book, pay for and travel on scheduled passenger trips between published departure points in Nigeria.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        These Terms of Use govern your use of the app and every booking you make through it. When you sign in with Google, you accept these terms. If you do not accept them, please do not use the app.
                    </>
                ),
            },
        ],
    },
    {
        id: "eligibility",
        title: "Who may use the app",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        You must be at least 14 years old to hold an account. You must be legally able to enter into a contract where you live, and you must use the app for yourself or for people you are authorised to book for.
                    </>
                ),
            },
            {
                kind: "list",
                items: [
                    <>
                        Give us accurate information about yourself and keep it up to date. A wrong phone number or date of birth can stop a trip from running.
                    </>,
                    <>
                        Keep your account to yourself. One account per person. Do not let anyone else sign in to it.
                    </>,
                    <>
                        You are responsible for everything done through your account. Tell us straight away if you think someone else has used it.
                    </>,
                ],
            },
        ],
    },
    {
        id: "your-account",
        title: "Signing in and your account",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        We sign you in with Google. When you do, Google shares your name, email address and profile picture with us. We never see or store your Google password. You can change what you share with Google in your Google account settings.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        You can update your details from{" "}
                        <a
                            href="/settings/profile"
                            className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                        >
                            Settings
                        </a>
                        . You can deactivate a driver profile or delete your account entirely from{" "}
                        <a
                            href="/settings/danger"
                            className="text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
                        >
                            Settings &rarr; Delete account
                        </a>
                        . Deleting your account signs you out and cannot be undone.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        We may suspend or close an account that gives us false information, is used to fraud or evade a payment, or breaks these terms. Where we can, we will tell you why first.
                    </>
                ),
            },
        ],
    },
    {
        id: "how-booking-works",
        title: "How booking a trip works",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        To book, you choose a departure point, a destination, a date, and one of the published departure times. You then tell us who is travelling: at least one and up to four passengers, each with a full name, email address and phone number.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        A booking is confirmed once we have received your payment. We send a confirmation email to you, and one to each passenger, with the trip details. A booking is the whole vehicle and seats up to four passengers. You pay for all four seats whether or not you fill them. A very busy departure may carry more than one booking, each in its own vehicle.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        We start looking for a driver as soon as your booking is paid for. A departure runs once a verified driver has accepted it. If no driver accepts it before the departure time, the trip does not run: we cancel it and refund the fare to everyone who paid, as set out under Cancellations and refunds below.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        You are responsible for the accuracy of the passenger details you give us. Do not book for anyone who has not agreed to travel. We share each passenger&rsquo;s name, email address, phone number and whether they are bringing luggage with the driver assigned to the trip, so the driver can run it. We do not share those details with other passengers, other drivers or anyone else.
                    </>
                ),
            },
        ],
    },
    {
        id: "fares-and-fees",
        title: "Fares, service fees and luggage",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Fares are set per departure point and shown in the app before you book. What you pay is made up of:
                    </>
                ),
            },
            {
                kind: "list",
                items: [
                    <>the fare for all four seats on the vehicle;</>,
                    <>
                        a service fee for all four seats; and
                    </>,
                    <>
                        a luggage charge for each passenger who is travelling with luggage.
                    </>,
                ],
            },
            {
                kind: "p",
                text: (
                    <>
                        The app shows you the full total before you pay. We do not add charges to a confirmed booking afterwards. All amounts are in Nigerian naira (NGN).
                    </>
                ),
            },
        ],
    },
    {
        id: "payment",
        title: "Paying for a trip",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Payments are taken by Kora, our payment provider, on Kora&rsquo;s own checkout page. You enter your payment details there, and they go straight to Kora. We never see them and never store them. We receive only a confirmation of what you paid, together with the bank account that any refund would return to.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        We accept bank transfer through Kora. Your booking is confirmed when Kora confirms the payment to us, not when you leave the checkout page. Please wait for the confirmation email before you travel. If you have paid but nothing has arrived by the departure time, contact us and we will trace it.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        Every booking is paid for separately. If you book the same departure more than once, each booking is its own payment and each is confirmed or refunded on its own.
                    </>
                ),
            },
        ],
    },
    {
        id: "cancellations-and-refunds",
        title: "Cancellations and refunds",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        If a trip is cancelled by the driver assigned to it, or by us, we refund every passenger who has already paid, back to the same account they paid from.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        A trip is also cancelled when we cannot find a driver for it. That happens when no verified driver accepts it before the departure time. You are never charged for a trip that did not run: we refund the fare to everyone who paid.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        Refunds are issued for the fare you paid for the trip itself. Service fees are not refunded, because they are not passed on to the driver. Refunds go back through Kora to your original payment method and normally appear within a few working days, depending on your bank.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        If you cannot travel, contact us before the departure time and we will look at what we can do. We cannot promise a self-service cancellation in the app yet, but we will always look at your request.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        If a refund fails, we keep trying in the background and email you if it does not go through.
                    </>
                ),
            },
        ],
    },
    {
        id: "delays-and-changes",
        title: "Delays and changes",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Transport depends on roads, traffic and other things outside our control. Departure times are the times we plan to leave, not guarantees.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        If your plans change, such as a delayed train or a missed connection, tell us as early as you can and we will help you move to the next available departure or cancel your booking under the clause above. The later you tell us, the fewer options there will be.
                    </>
                ),
            },
        ],
    },
    {
        id: "driving-with-us",
        title: "Driving with us",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Driving with us is a separate arrangement between you and Daily Express LTD. You use your own vehicle, you pick which trips to take and when, and there is no fixed roster, no set hours and no minimum number of trips.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        To take trips you must be verified first. That means proving your bank account details and verifying your identity with a BVN or NIN through our payment provider&rsquo;s identity service. We also ask for a profile photo, your phone number, and where you are based so we can match you to departures nearby.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        When a departure needs a driver, we may call you automatically. You can accept or decline from the call. Declining costs you nothing and does not remove you from the platform.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        You agree to turn up for trips you accept, with a vehicle that is roadworthy and legal to carry passengers, a valid driving licence, and all the documents the law requires of you. You can cancel or complete a trip from your driver calendar.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        You are paid the fare for trips you complete, minus nothing on our side. We transfer it to your verified bank account once you complete a trip. If a transfer fails, we email you and you can retry it from your calendar.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        We can suspend or deactivate a driver profile that fails verification, stops taking trips, or whose details no longer match your verified identity. You can deactivate your own profile at any time from Settings; your trip history is kept.
                    </>
                ),
            },
        ],
    },
    {
        id: "acceptable-use",
        title: "Acceptable use",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Do not use the app to break the law, to harass or threaten anyone, or to attempt to get access to anything that is not yours. Specifically, do not:
                    </>
                ),
            },
            {
                kind: "list",
                items: [
                    <>book with false, invented or someone else&rsquo;s details;</>,
                    <>attempt bookings, payouts or promotions you are not entitled to;</>,
                    <>probe, scan or test the security of the app without our written permission;</>,
                    <>scrape, copy or reverse-engineer the app; or</>,
                    <>resell or redistribute access to the app.</>,
                ],
            },
            {
                kind: "p",
                text: (
                    <>
                        We may suspend an account that does any of this, and we will cooperate with the authorities where the law requires it.
                    </>
                ),
            },
        ],
    },
    {
        id: "safety",
        title: "Safety and complaints",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        Your safety matters more than any trip. Keep your seatbelt on, follow the driver&rsquo;s reasonable instructions, and do not board a vehicle you believe is unsafe.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        Every driver is identity- and bank-verified before they can take a trip with us. That is a baseline, not a guarantee, and it does not replace your own judgement about whether a driver or vehicle is safe to travel with.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        If something goes wrong, such as a safety incident, a driver who did not turn up, or a fare you think is wrong, contact us as soon as you can and we will investigate. Serious or immediate danger should go to the police first, and then to us.
                    </>
                ),
            },
        ],
    },
    {
        id: "our-content",
        title: "Intellectual property",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        The app, its name, its design, and the software behind it belong to Daily Express LTD or our licensors. Passenger and driver details belong to the people they belong to.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        You may not copy or reuse our branding, or take screenshots of the app for commercial use, without our written permission.
                    </>
                ),
            },
        ],
    },
    {
        id: "availability",
        title: "Availability and third-party services",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        The app depends on services we do not control, including Google for sign-in and Kora for payments and identity checks. If one of them is down, bookings and payments may not work for a while. We aim to keep the app available at all times but do not promise that it will never be unavailable.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        We may change, suspend or withdraw any part of the app, including a departure point, a destination or a fare. Where we withdraw something you have already booked and paid for, we treat it as a cancellation under Cancellations and refunds.
                    </>
                ),
            },
        ],
    },
    {
        id: "liability",
        title: "Disclaimers and liability",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        The app and the trips on it are provided as they are. To the fullest extent the law allows, we exclude any warranty that the app will be uninterrupted, error-free, or that a departure will run exactly to schedule.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        We are not liable for indirect or consequential loss, such as lost profits, lost earnings, lost opportunities, or damage to property, arising from your use of the app or from a trip.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        Nothing in these terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else the law does not allow us to limit.
                    </>
                ),
            },
        ],
    },
    {
        id: "indemnity",
        title: "Indemnity",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        You agree to cover Daily Express LTD against claims, losses and reasonable costs that come from you breaking these terms, from information you give us being wrong or misleading, or from anything you do through your account.
                    </>
                ),
            },
        ],
    },
    {
        id: "governing-law",
        title: "Governing law and disputes",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Nigeria have exclusive jurisdiction over any dispute arising from them.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        Before going to court, please talk to us. Most problems are a misunderstanding or a payment that is still moving, and we would much rather sort it out with you.
                    </>
                ),
            },
        ],
    },
    {
        id: "changes",
        title: "Changes to these terms",
        blocks: [
            {
                kind: "p",
                text: (
                    <>
                        We may change these terms from time to time. When we do, we will update the date at the top of this page and, if the change is significant, tell you in the app before it takes effect.
                    </>
                ),
            },
            {
                kind: "p",
                text: (
                    <>
                        Continuing to use the app after a change means you accept the updated terms.
                    </>
                ),
            },
        ],
    },
];

const TermsPage = () => (
    <>
        <LegalNavbar />
        <main className="mx-auto w-full max-w-[62rem] px-4 py-10 sm:px-6 md:py-16">
            <LegalDocument
                title="Terms of Use"
                clauses={clauses}
                sibling={{
                    href: "/privacy",
                    label: "Privacy Policy",
                    prompt:
                        "This document covers the deal between us. For what we collect about you and who we share it with, read the",
                }}
            />
        </main>
    </>
);

export default TermsPage;