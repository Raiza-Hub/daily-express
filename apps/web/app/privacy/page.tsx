import type { Metadata } from "next";
import Footer from "@repo/ui/Footer";
import Navbar from "~/components/Navbar";
import { buildWebMetadata } from "../lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "Privacy Policy",
  description:
    "Learn how Daily Express collects, uses, protects, and shares personal information.",
  path: "/privacy",
});

const sections = [
  {
    title: "1. Introduction",
    body: [
      "Welcome to Daily Express. This Privacy Policy explains how we collect, use, disclose, retain, and protect information when you use Daily Express.",
      "Daily Express operates an intercity road travel marketplace. Passengers can search routes, book seats, pay for trips, review booking status, and receive service messages. Drivers can create routes, manage passengers, receive notifications, and manage payout information.",
      "Because Daily Express helps coordinate real-world travel, we may process information needed for booking confirmation, passenger identification, driver contact, trip operation, support, safety review, payments, payouts, refunds, and dispute handling.",
      "This policy applies to Daily Express websites, Daily Express Driver, APIs, checkout flows, notifications, support channels, and related services. Our Terms of Service also apply to your use of Daily Express.",
    ],
  },
  {
    title: "2. Definitions",
    body: [
      "Service means Daily Express websites, apps, APIs, route listings, booking flows, checkout flows, driver tools, notifications, support channels, and related services.",
      "Personal information means information that identifies, relates to, describes, or can reasonably be linked to a person, account, device, booking, driver profile, payment, payout, or support request.",
      "Travel information means information connected to a route or booking, such as pickup and dropoff locations, meeting point, trip date, departure and arrival times, vehicle type, seats, fare, booking reference, passenger name, driver details, trip status, and support records.",
      "Usage information means information collected automatically from your browser, device, or interaction with the service, such as pages viewed, feature events, device information, approximate technical identifiers, errors, diagnostics, and security signals.",
      "Service providers means companies that process information for Daily Express, such as hosting, payments, payouts, email delivery, image hosting, analytics, maps or place lookup, customer support, monitoring, and security providers.",
    ],
  },
  {
    title: "3. Information We Collect",
    body: [
      "Account information: first name, last name, email address, date of birth, password credentials, email verification status, Google sign-in identifiers, password reset records, and account session information.",
      "Passenger booking information: route searches, pickup and dropoff locations, meeting points, trip dates, departure and estimated arrival times, seat assignments, booking references, passenger names used for booking lookup or boarding support, payment status, cancellation or confirmation status, trip booking availability status, no-show or support notes where applicable, and booking history.",
      "Driver information: profile photo, phone number, email address, country, state, city, address, route listings, vehicle type, meeting point, available seats, trip timing, passenger counts, driver activity, payout status, and public driver profile details shown to passengers for booked or available trips.",
      "Payment and payout information: payment references, checkout links, transaction status, payment provider responses, refund status, payout recipient details, bank name, bank code, account name, account number or last four digits, transfer references, payout attempts, passenger checkout fees, provider fees, settlement status, and related webhook payloads.",
      "Communications and notifications: OTP emails, password reset emails, booking confirmations, route or schedule updates, payout or refund failure emails, push notification subscriptions, notification read/archive status, support requests, incident reports, and service messages.",
      "Device, usage, and diagnostics information: cookies, local storage consent choices, page views, feature events, errors, exception reports, approximate technical identifiers, browser and device information, and, where enabled, analytics session replay data. Password inputs are configured to be masked in analytics tooling.",
      "Location information: typed pickup, dropoff, meeting point, and stop searches; route location labels; and place details used to show travel options. We do not need continuous background location tracking to provide the current service.",
      "Safety, support, and dispute information: information you, drivers, passengers, providers, or support teams provide about complaints, refunds, route cancellations, trip disruptions, passenger conduct, driver conduct, accessibility requests, luggage issues, payment issues, or other service incidents.",
    ],
  },
  {
    title: "4. Sources of Information",
    body: [
      "We collect information directly from you when you create an account, update your profile, search for trips, book a seat, pay, create driver routes, upload a driver profile image, save payout details, contact support, report an incident, request assistance, or consent to cookies.",
      "We collect information automatically when you use the service, including cookies, local storage, analytics events, device information, browser information, error reports, and diagnostic information.",
      "We may receive information from passengers, drivers, transport operators, payment and payout providers, banks, support vendors, infrastructure providers, monitoring providers, and security services where that information is needed to operate, secure, support, or review the service.",
      "We also receive information from service providers that help us run the platform, including Google for sign-in, Kora for payments and payouts, Cloudinary for driver image hosting, email delivery providers, push notification services, analytics providers, maps or place lookup providers, and infrastructure or security services.",
    ],
  },
  {
    title: "5. How We Use Information",
    body: [
      "We use personal information to create and secure accounts, verify email addresses, authenticate sessions, process Google sign-in, reset passwords, and prevent unauthorized access.",
      "We use trip, route, and booking information to show available trips, reserve seats, prevent duplicate active bookings, assign seats, generate booking records, support passenger identification, close booking availability for trips when drivers stop new bookings, help drivers understand passenger demand, and let passengers retrieve booking status.",
      "We use payment and payout information to initialize checkout, verify successful payments, process refunds where needed, calculate driver earnings from confirmed route fares, pay drivers, reconcile provider webhooks, detect failed transactions, and maintain financial records.",
      "We use communication information to send OTPs, password reset links, booking confirmations, route or schedule updates, service notices, push notifications, payout updates, refund notices, and support responses.",
      "We use safety, support, and dispute information to investigate complaints, verify booking ownership, coordinate with drivers or providers, prevent misuse, respond to incidents, protect passengers and drivers, and establish, exercise, or defend legal claims.",
      "We use analytics and diagnostic information to understand product usage, measure reliability, debug errors, improve the booking experience, protect the service, and make decisions about product performance.",
      "We may use information to comply with law, enforce our terms, resolve disputes, investigate fraud or abuse, and protect passengers, drivers, Daily Express, and the public.",
    ],
  },
  {
    title: "6. Cookies and Similar Technologies",
    body: [
      "Daily Express uses cookies, local storage, and similar technologies for authentication, OAuth security, session management, booking and checkout continuity, preference storage, analytics, error reporting, and product improvement.",
      "Our cookie banner lets you accept or decline non-essential analytics persistence. If you decline, analytics storage is limited to memory where supported, though essential cookies and storage needed for login, security, checkout, and service operation may still be used.",
      "You can also manage cookies through your browser settings. Blocking essential cookies may prevent sign-in, checkout, or driver tools from working correctly.",
    ],
  },
  {
    title: "7. How We Share Information",
    body: [
      "Drivers and passengers: passengers may see driver name, phone number, profile photo, route, meeting point, vehicle type, location labels, and trip timing. Drivers may see passenger names or initials, booking status, seat or passenger counts, booking references, and trip-related details needed to operate a route or verify a passenger.",
      "Payment and payout providers: we share transaction, customer, booking, payout, bank, and webhook information with Kora and related payment infrastructure to process passenger payments, refunds, and driver payouts.",
      "Transport operations and support: we may share booking, route, passenger, driver, payment, or incident information with drivers, transport operators, support providers, payment providers, or other relevant parties when needed to operate a trip, resolve a dispute, process a refund, investigate a safety issue, or provide support.",
      "Service providers: we share information with vendors that provide hosting, databases, email delivery, analytics, error reporting, file hosting, maps or place lookup, push notification delivery, fraud prevention, customer support, and operational tooling.",
      "Legal, safety, and business purposes: we may disclose information when required by law, to protect rights and safety, to investigate misuse or incidents, to enforce agreements, to respond to lawful requests, or as part of a merger, acquisition, financing, reorganization, or sale of assets.",
      "Consent and requested actions: we may share information when you direct us to do so or when sharing is necessary to complete an action you requested.",
      "We do not sell personal information for money. We also do not share personal information for cross-context behavioral advertising based on the current product implementation.",
    ],
  },
  {
    title: "8. Payments and Payouts",
    body: [
      "Daily Express uses third-party payment and payout providers to process passenger payments, refunds, driver payouts, bank verification, transaction reconciliation, and related records.",
      "We do not intend to store full payment card details on Daily Express systems. Payment details may be collected and processed directly by payment providers under their own terms and privacy notices.",
      "We may store payment references, checkout links, transaction status, webhook results, refund status, payout recipient details, bank metadata, payout attempts, booking amounts, route fare records, and related audit records so we can confirm bookings, pay drivers, handle disputes, and comply with legal, tax, accounting, and fraud-prevention obligations.",
    ],
  },
  {
    title: "9. Analytics and Diagnostics",
    body: [
      "We use analytics and diagnostic tools to understand product usage, measure reliability, debug errors, improve booking and driver workflows, reduce failed checkouts, protect the service, and make product decisions.",
      "Daily Express currently uses PostHog for product analytics, page views, page leave events, exception capture, and session replay configured to mask password inputs. Optional analytics persistence can be accepted or declined through our cookie controls.",
      "Analytics and diagnostics may include page views, feature events, approximate technical identifiers, device and browser information, errors, and session-level interaction data where enabled.",
    ],
  },
  {
    title: "10. Retention",
    body: [
      "We keep personal information for as long as needed to provide the service, maintain account and booking records, support trip operations, process payments and payouts, comply with legal, tax, accounting, fraud prevention, transport, and security obligations, resolve disputes, and enforce agreements.",
      "Some temporary records, such as OTPs, password reset tokens, booking holds, checkout expiry jobs, webhook processing records, and session data, are designed to expire or become inactive. Some transaction, payout, booking, incident, support, security, and audit records may be retained longer where required for legitimate business, safety, regulatory, or legal reasons.",
    ],
  },
  {
    title: "11. Security",
    body: [
      "We use technical and organizational measures intended to protect personal information, including authenticated API access, session controls, password hashing, OAuth protections, webhook signature checks, service-level access controls, database constraints, retries and idempotency for critical events, and monitoring for errors.",
      "We also use security and fraud-prevention measures to help protect bookings, passenger lists, payment references, payout details, driver profiles, and support records.",
      "No online service can guarantee absolute security. You should use a strong password, keep your email account secure, sign out on shared devices, protect your booking reference, and contact us if you believe your account or booking information has been misused.",
    ],
  },
  {
    title: "12. International Processing",
    body: [
      "Daily Express may process and store information in countries where we, our infrastructure providers, and our service providers operate. Those countries may have data protection rules different from where you live.",
      "When we transfer information, we rely on appropriate legal, contractual, technical, and operational safeguards where required.",
    ],
  },
  {
    title: "13. Your Choices and Rights",
    body: [
      "You can access and update passenger profile information in account settings. Drivers can update driver profile and payout details in Daily Express Driver. You can disconnect Google sign-in where supported and delete your account from settings.",
      "Depending on your location, you may have rights to request access, correction, deletion, portability, restriction, objection, withdrawal of consent, or information about how your personal information is used and shared.",
      "California residents, where applicable, may have rights to know, delete, correct, opt out of sale or sharing, limit use of sensitive personal information, and not be discriminated against for exercising privacy rights. Daily Express does not currently sell personal information or share it for cross-context behavioral advertising.",
      "Nigeria, UK, EEA, and similar privacy-law residents may have rights to clear privacy information, lawful processing, access, correction, deletion, restriction, objection, portability, and complaint to a data protection authority, subject to legal limits.",
      "To make a privacy request, contact us at support@dailyexpress.app. We may need to verify your identity before completing a request, and some information may be retained where required for legal, safety, transport operations, fraud prevention, payment, tax, accounting, or dispute-resolution reasons.",
    ],
  },
  {
    title: "14. Service Providers",
    body: [
      "Daily Express uses a limited number of service providers to help deliver, secure, monitor, and improve the service. These providers may access personal information only as needed to perform services for us or as otherwise permitted by law.",
      "Current service provider categories include hosting and infrastructure, databases, payment and payout processing, Google sign-in, email delivery, image hosting, push notifications, analytics, error monitoring, maps or place lookup, fraud prevention, customer support, and operational tooling.",
      "Service providers may have their own terms and privacy notices. We encourage you to review the privacy notices of third-party services that process your information in connection with Daily Express.",
    ],
  },
  {
    title: "15. Links to Other Sites",
    body: [
      "Daily Express may link to websites or services that we do not operate. If you click a third-party link, you will be directed to that third party's site or service.",
      "We do not control and are not responsible for third-party content, privacy policies, security practices, or services. You should review the privacy policy of every third-party site or service you use.",
    ],
  },
  {
    title: "16. Children",
    body: [
      "Daily Express is not intended for children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has provided us personal information, contact us so we can review and delete it where appropriate.",
    ],
  },
  {
    title: "17. Changes to This Policy",
    body: [
      "We may update this Privacy Policy from time to time by posting the updated policy on this page. If a change is material, we may take additional reasonable steps to notify users, such as changing the effective date or providing an in-product or email notice.",
      "Your continued use of Daily Express after an updated Privacy Policy becomes effective means you acknowledge the updated policy.",
    ],
  },
  {
    title: "18. Contact Us",
    body: [
      "For privacy questions, account requests, or complaints, contact Daily Express at support@dailyexpress.app.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="dailyexpress-update-offset-top bg-white sticky top-0 z-50">
        <Navbar />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-16">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-neutral-950">
            Privacy Policy
          </h1>
          <p className="text-base text-neutral-500">
            Last updated: May 9, 2026
          </p>
        </div>

        <div className="space-y-10">
          {sections.map((section) => (
            <section key={section.title} className="space-y-4">
              <h2 className="text-2xl font-bold tracking-tight text-neutral-950">
                {section.title}
              </h2>
              <div className="space-y-4">
                {section.body.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="text-base leading-7 text-neutral-600"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <Footer className="max-w-7xl mx-auto w-full mt-auto" />
    </div>
  );
}
