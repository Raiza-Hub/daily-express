import type { Metadata } from "next";
import Footer from "@repo/ui/Footer";
import Navbar from "~/components/Navbar";
import { buildWebMetadata } from "../lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "Terms of Service",
  description:
    "Review the terms that govern your use of Daily Express passenger and driver services.",
  path: "/terms",
});

const sections = [
  {
    title: "1. Introduction",
    body: [
      "Welcome to Daily Express. These Terms of Service govern your access to and use of Daily Express, including our passenger website, Daily Express Driver, APIs, checkout flows, route listings, booking records, notifications, support channels, and related services.",
      "Daily Express is designed for intercity road travel. These Terms explain the rules that apply when passengers search for and book trips, and when drivers or transport operators publish routes, manage passengers, and receive payouts.",
      "Our Privacy Policy also applies to your use of Daily Express and explains how we collect, use, protect, and share information. If you create an account, search for a trip, book a seat, list a route, manage passengers, accept a payout, or otherwise use Daily Express, you agree to these Terms. If you do not agree, you may not use the service.",
    ],
  },
  {
    title: "2. The Service",
    body: [
      "Daily Express operates an intercity road travel marketplace. Passengers can search routes, compare trip details, reserve seats, pay for bookings, review booking status, and receive service messages. Drivers can create route listings, manage passenger activity, receive notifications, and manage payout information.",
      "Daily Express is a technology platform and marketplace, not the operator of every listed vehicle. We help coordinate discovery, booking, payment, notification, and payout workflows. Drivers and transport operators remain responsible for the routes they publish, the vehicles they use, the trip they operate, and compliance with transport laws that apply to them.",
      "The service may support trip search, booking confirmation, passenger lists, driver contact details, payment verification, booking lookup, trip status, service notices, payout history, and support workflows. A booking record does not guarantee that road conditions, timing, vehicle availability, law enforcement activity, or other operational circumstances will remain unchanged.",
      "We may add, remove, suspend, or change parts of the service as the product, providers, law, transport operations, or business needs change. Some features may have additional rules or provider terms. If feature-specific terms conflict with these Terms, the more specific terms apply for that feature unless applicable law requires otherwise.",
    ],
  },
  {
    title: "3. Eligibility and Accounts",
    body: [
      "You must be able to form a binding agreement and use Daily Express lawfully. You may not use Daily Express if you are barred from doing so by law or if we have suspended or terminated your access.",
      "When you create an account or submit information, you agree to provide accurate, complete, and current details. This includes passenger account information, passenger names used for booking lookup, driver profile information, route details, vehicle details, meeting points, payment information, payout information, and support information.",
      "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account. You may not transfer, sell, lend, or misuse your account, booking reference, driver profile, passenger list, or payout access.",
      "Tell us promptly at support@dailyexpress.app if you believe your account, booking reference, payment information, driver profile, passenger information, or payout details have been misused.",
      "We may require email verification, Google sign-in checks, password reset checks, bank verification, fraud prevention review, or other account-security steps before allowing access to certain features.",
    ],
  },
  {
    title: "4. Passenger Bookings",
    body: [
      "Trip search results depend on driver route listings, available seats, trip date, route status, vehicle type, pricing, and system availability. Search results do not guarantee that a seat will remain available until checkout is completed.",
      "When you start checkout, Daily Express may create or reuse a pending booking hold for the selected route and trip date. A booking is not final until payment is successfully verified and the booking is confirmed in our system. Passengers should be prepared to show booking confirmation, booking reference, name, or other reasonable proof of booking when boarding or resolving support issues.",
      "You are responsible for reviewing the pickup and dropoff details, meeting point, trip date, departure time, estimated arrival time, vehicle type, fare, fees, driver information, and any luggage, accessibility, child-travel, or special assistance needs before paying.",
      "Drivers may close booking for a trip. Closing booking prevents additional passengers from booking that trip, but it does not automatically cancel, complete, or change existing confirmed bookings.",
      "Passengers are responsible for arriving at the meeting point early enough to board. If you are absent at the scheduled departure time or cannot reasonably be identified against the booking record, the driver may depart and the booking may be treated as unused, subject to applicable law and any support review.",
      "Travel may be affected by traffic, weather, driver availability, vehicle issues, route diversions, road closures, enforcement actions, safety conditions, passenger conduct, and other real-world circumstances. We use reasonable efforts to support accurate listings and service messages, but exact pickup, arrival, route, and timing may vary.",
    ],
  },
  {
    title: "5. Prices, Fees, Payments, and Refunds",
    body: [
      "Prices are shown in Nigerian naira unless stated otherwise. Passenger checkout may include the route fare plus a transaction, processing, or platform fee. Payment provider or bank charges may also apply depending on the payment method and provider rules.",
      "Daily Express uses third-party payment infrastructure, including Kora, to initialize, verify, reconcile, refund, and audit payments. By paying through Daily Express, you authorize us and our payment providers to process the information needed to complete checkout.",
      "We may refuse, expire, cancel, or refund a payment if a booking hold expires, the amount or currency cannot be verified, the trip is unavailable, the payment provider reports failure or cancellation, fraud or misuse is suspected, or applicable law requires it.",
      "If a payment succeeds after a booking hold expires or cannot be matched to a valid booking, Daily Express may initiate a refund rather than confirm the booking. Refund timing depends on payment provider and bank processing. Provider fees, bank charges, or lawful cancellation charges may affect the amount or timing of a refund where permitted by law.",
      "Cancellation and refund outcomes may depend on timing, trip status, driver conduct, no-show circumstances, provider status, reasonable cancellation charges, safety issues, route cancellation, service disruption, and applicable consumer-protection law. Nothing in these Terms limits rights that cannot lawfully be limited.",
    ],
  },
  {
    title: "6. Driver Responsibilities",
    body: [
      "Drivers must provide accurate identity, contact, address, profile, vehicle, route, meeting point, seating, price, bank, and payout information. Drivers must keep route listings current and must not list routes they cannot lawfully, safely, or professionally operate.",
      "Drivers are responsible for required licenses, permits, vehicle roadworthiness, insurance, safety equipment, passenger handling, route operation, punctuality, lawful conduct, and any obligations owed to passengers or regulators.",
      "Drivers must honor confirmed bookings, communicate material trip changes promptly, handle passengers respectfully, keep trip availability accurate, and follow reasonable safety, boarding, luggage, and passenger-identification practices. Closing booking for a trip does not cancel existing confirmed bookings or mark the trip as completed.",
      "Drivers must not carry passengers beyond lawful capacity, misstate vehicle type or seat availability, list unavailable trips, create duplicate misleading routes, or use passenger information for purposes unrelated to the booked trip.",
      "Driver payouts are based on confirmed bookings, completed trips, available earnings, verified bank details, provider processing, and any applicable review. Payouts may be delayed, retried, placed in manual review, or withheld where bank details are missing or unverified, a trip is not completed, fraud is suspected, a dispute exists, passenger claims are unresolved, provider balance is unavailable, provider fees apply, or law requires it.",
    ],
  },
  {
    title: "7. User Content and License",
    body: [
      "You may submit information, listings, route descriptions, pickup and dropoff labels, meeting point instructions, images, messages, support requests, and other content through Daily Express. You are responsible for the content you provide, including its accuracy, legality, reliability, and appropriateness.",
      "You keep ownership of content you submit. You grant Daily Express a worldwide, non-exclusive, royalty-free license to host, use, copy, display, transmit, modify for formatting, and process that content as needed to operate, secure, support, improve, and promote the service.",
      "You represent that you have the rights needed to provide your content and that your content does not violate the rights of any person or entity. We may remove or restrict content that we believe violates these Terms, creates risk, or is otherwise inappropriate for the service.",
    ],
  },
  {
    title: "8. Prohibited Uses",
    body: [
      "You may use Daily Express only for lawful personal or business purposes related to searching, booking, listing, operating, paying for, or managing Daily Express trips.",
      "You may not use Daily Express to violate law, submit false or misleading trip information, impersonate another person, harass users, misuse driver or passenger contact details, process fraudulent payments, evade verification, create abusive duplicate accounts, interfere with boarding or trip operations, or interfere with another user's use of the service.",
      "You may not use Daily Express to carry prohibited, unsafe, illegal, or undeclared goods; coordinate unlawful transport activity; threaten passengers or drivers; bypass fare or booking rules; or create safety, security, regulatory, or fraud risks.",
      "You may not bypass security, scrape or overload systems, reverse engineer non-public code, introduce malware, probe for vulnerabilities, disrupt service infrastructure, or use Daily Express in a way that harms passengers, drivers, providers, Daily Express, or the public.",
    ],
  },
  {
    title: "9. Intellectual Property",
    body: [
      "Daily Express, its software, interfaces, logos, page designs, text, graphics, service content, and related materials are owned by Daily Express or its licensors and are protected by intellectual property and other laws.",
      "You may not copy, modify, distribute, sell, lease, create derivative works from, or use Daily Express materials for commercial purposes except as allowed by law, by the service, or by our written permission.",
      "Nothing in these Terms gives you ownership of Daily Express intellectual property. You may not use the Daily Express name, logo, or brand in a way that suggests endorsement or partnership without our written permission.",
    ],
  },
  {
    title: "10. Third-Party Services",
    body: [
      "Daily Express works with third-party services for payments, payouts, Google sign-in, email delivery, image hosting, analytics, maps or place lookup, notifications, hosting, databases, monitoring, security, customer support, and operational tooling.",
      "Third-party services may have their own terms, privacy notices, availability limits, fees, verification rules, and error conditions. Daily Express is not responsible for third-party services beyond what applicable law requires.",
      "Trips may also involve independent drivers, transport operators, vehicle owners, roadside personnel, stations, stops, payment providers, banks, or other third parties. Their conduct, facilities, vehicles, and services may be subject to their own rules and legal obligations.",
      "Our service may contain links to third-party websites or services. We do not control those third parties and are not responsible for their content, policies, availability, or practices.",
    ],
  },
  {
    title: "11. Availability and Changes",
    body: [
      "We aim to keep Daily Express reliable, but we do not guarantee uninterrupted, error-free, or continuously available service. The service may be unavailable or degraded because of maintenance, deployments, provider outages, network issues, security events, force majeure events, transport disruptions, or other circumstances.",
      "We may withdraw, amend, restrict, or suspend any part of the service at any time. Where a change materially affects existing paid bookings or rights that cannot lawfully be limited, we will handle the change in a reasonable manner and as required by law.",
      "We may also set or change operational limits, including booking limits, payment limits, payout rules, route listing rules, passenger verification practices, luggage guidance, fraud controls, or support processes.",
    ],
  },
  {
    title: "12. Suspension and Termination",
    body: [
      "You may stop using Daily Express at any time. Account settings may allow you to delete your account, subject to retention required for legal, payment, safety, tax, accounting, fraud prevention, and dispute-resolution reasons.",
      "We may suspend, restrict, or terminate access immediately if we believe you violated these Terms, created risk for passengers or drivers, submitted inaccurate information, failed required verification, misused payments or payouts, threatened platform integrity, disrupted trip operations, or acted unlawfully.",
      "Suspension or termination does not automatically cancel obligations that already arose, including payment obligations, payout review, refunds, disputes, legal compliance, or provisions that by nature should survive termination.",
    ],
  },
  {
    title: "13. Disclaimers",
    body: [
      "Daily Express is provided on an as-is and as-available basis to the extent allowed by law. We do not promise that every route, driver, vehicle, seat, payment, payout, notification, search result, or provider integration will be available, accurate, uninterrupted, or free from error at all times.",
      "Drivers and transport operators are independent providers of transportation services. Daily Express may support booking, payment, notifications, and dispute handling, but we do not personally drive, own, maintain, license, insure, dispatch, or operate every vehicle listed by drivers.",
      "Daily Express is not an emergency transportation service. Do not use the service for urgent medical transport, evacuation, law-enforcement transport, or any situation where immediate professional emergency response is required.",
      "Nothing in these Terms excludes warranties, consumer guarantees, safety obligations, refund rights, or other rights that cannot lawfully be excluded. Where the law gives you non-waivable rights, those rights continue to apply.",
    ],
  },
  {
    title: "14. Limitation of Liability",
    body: [
      "To the extent allowed by law, Daily Express is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, lost profits, lost data, missed trips, missed connections, provider outages, travel delays, or losses caused by driver, passenger, transport operator, or third-party conduct.",
      "To the extent allowed by law, Daily Express's total liability for a claim related to a paid passenger booking will not exceed the amount you paid to Daily Express for that booking. For other claims, our total liability will not exceed the amount you paid to Daily Express for the service giving rise to the claim in the three months before the claim.",
      "These limits do not apply where liability cannot lawfully be limited, including where applicable law prohibits limiting liability for fraud, willful misconduct, certain negligence, personal injury, consumer-protection rights, or other non-waivable obligations.",
    ],
  },
  {
    title: "15. Indemnity",
    body: [
      "To the extent allowed by law, you agree to defend and indemnify Daily Express from claims, losses, liabilities, damages, costs, and expenses arising from your misuse of the service, breach of these Terms, violation of law, inaccurate route or account information, driver operations, passenger misconduct, luggage or goods you carry, payment or payout misuse, or infringement of third-party rights.",
      "This indemnity does not require you to indemnify Daily Express for matters where applicable law prohibits that obligation.",
    ],
  },
  {
    title: "16. Governing Law and Disputes",
    body: [
      "Please contact support@dailyexpress.app first so we can try to resolve booking, payment, payout, driver, passenger, or account issues quickly.",
      "When reporting a dispute, provide relevant details such as booking reference, payment reference, route, trip date, meeting point, account email, driver or passenger name, incident details, and a clear description of the issue. We may request additional information to verify ownership, investigate, coordinate with providers, or comply with legal obligations.",
      "These Terms are governed by the laws of the Federal Republic of Nigeria, without regard to conflict-of-law rules, unless mandatory consumer law in your location requires another rule. Courts with competent jurisdiction in Nigeria will handle disputes unless applicable law requires another forum.",
    ],
  },
  {
    title: "17. Changes to These Terms",
    body: [
      "We may update these Terms from time to time by posting the updated Terms on this page. If a change is material, we may take additional reasonable steps to notify users, such as changing the effective date or providing an in-product or email notice.",
      "Your continued use of Daily Express after updated Terms become effective means you accept the updated Terms. If you do not agree to updated Terms, you should stop using the service.",
    ],
  },
  {
    title: "18. Contact Us",
    body: [
      "For questions about these Terms, contact Daily Express at support@dailyexpress.app.",
    ],
  },
];

export default function TermsPage() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="bg-white">
        <Navbar />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-16">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-neutral-950">
            Terms of Service
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
