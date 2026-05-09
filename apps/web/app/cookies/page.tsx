import type { Metadata } from "next";
import Footer from "@repo/ui/Footer";
import Navbar from "~/components/Navbar";
import { buildWebMetadata } from "../lib/seo";

export const metadata: Metadata = buildWebMetadata({
  title: "Cookie Notice",
  description:
    "Learn how Daily Express uses cookies and similar technologies for sign-in, checkout, analytics, security, and service reliability.",
  path: "/cookies",
});

const sections = [
  {
    title: "1. Introduction",
    body: [
      "This Cookie Notice explains how Daily Express uses cookies, local storage, pixels, analytics identifiers, and similar technologies when you visit or use our passenger website, driver tools, checkout flows, APIs, notifications, and related services.",
      "It explains what these technologies are, why we use them, the types of cookies and similar technologies involved, and how you can control them through your browser or device settings.",
      "For more information about how Daily Express collects, uses, shares, and protects personal information, please review our Privacy Policy.",
    ],
  },
  {
    title: "2. What Cookies Are",
    body: [
      "Cookies are small text files placed on your computer or mobile device when you visit a website. They contain information that can later be read by the website or service that set them.",
      "Cookies may be session cookies that are deleted when your browser session ends, or persistent cookies that remain on your device until they expire or you delete them.",
      "First-party cookies are set by Daily Express. Third-party cookies or similar technologies may be set by providers that help us deliver features, measure usage, process payments, monitor reliability, or protect the service.",
    ],
  },
  {
    title: "3. Similar Technologies",
    body: [
      "In addition to cookies, Daily Express may use local storage, session storage, pixels, SDK storage, analytics identifiers, and similar technologies.",
      "These technologies can help us remember service state, understand whether a page or flow worked, measure performance, detect errors, secure authentication, and improve passenger and driver workflows.",
    ],
  },
  {
    title: "4. Strictly Necessary Cookies",
    body: [
      "These cookies and similar technologies are essential for Daily Express to provide services you request. They support sign-in, account sessions, checkout access, booking lookup, route and location requests, security checks, Google OAuth protection, fraud prevention, and service reliability.",
      "Examples may include the `token` access cookie, `refreshToken` session cookie, and temporary Google OAuth cookies such as `oauth_state`, `oauth_nonce`, `oauth_code_verifier`, and `oauth_redirect`.",
      "Because these technologies are required for the service to work, they cannot be switched off through Daily Express. You can block them in your browser, but parts of the service may stop working.",
    ],
  },
  {
    title: "5. Analytics and Diagnostics Cookies",
    body: [
      "These technologies help us understand how passengers and drivers use Daily Express, which pages are viewed, whether booking or driver flows succeed or fail, and where errors occur.",
      "Daily Express currently uses PostHog for product analytics, page views, page leave events, exception capture, and session replay configured to mask password inputs.",
      "Analytics and diagnostics help us measure service performance, improve trip search and checkout, debug issues, and make Daily Express more reliable.",
    ],
  },
  {
    title: "6. Functional Storage and Similar Technologies",
    body: [
      "Some browser storage supports the experience without being used for advertising. This may include local storage, session storage, SDK storage, update prompt state, or device-level identifiers used by service tools.",
      "Functional storage can help remember interface state, support checkout continuity, improve page performance, and keep service features working between page loads.",
      "If you clear browser storage or use another browser or device, some preferences or temporary service states may reset.",
    ],
  },
  {
    title: "7. Advertising Cookies",
    body: [
      "Daily Express does not currently use advertising cookies to build advertising profiles or sell cookie information for money based on the current product implementation.",
      "If we introduce advertising cookies in the future, we will update this notice and provide any controls required by applicable law.",
    ],
  },
  {
    title: "8. How Daily Express Uses Cookies",
    body: [
      "Daily Express uses cookies and similar technologies for several reasons. Some are strictly necessary to operate the service and provide user-requested functionality, such as keeping accounts signed in, protecting authentication, supporting Google sign-in, passing authentication to booking and location API routes, starting checkout, and preventing abuse.",
      "Other technologies help us measure service reliability, understand how passengers and drivers move through the product, identify failed flows, and improve trip search, booking, checkout, driver route management, notifications, and payouts.",
      "We may also use similar technologies in emails or service messages to understand whether important messages are delivered or interacted with, where supported by our providers.",
    ],
  },
  {
    title: "9. Your Controls",
    body: [
      "Daily Express does not provide an in-page cookie preference button on this page. You can control cookies through your browser settings. Most browsers allow you to block cookies, delete existing cookies, receive alerts before cookies are stored, or limit cookies from certain websites.",
      "If you block or delete cookies, you may still be able to browse parts of Daily Express, but some features may be restricted or unavailable. Sign-in, checkout, booking lookup, account settings, location lookup, and driver tools may not work correctly without necessary cookies.",
      "Because browser controls vary, please visit your browser's help menu for instructions on managing cookies and similar storage.",
    ],
  },
  {
    title: "10. Changes to This Notice",
    body: [
      "We may update this Cookie Notice from time to time to reflect changes to the cookies and similar technologies we use, changes to our providers, new product features, or legal and regulatory requirements.",
      "Please revisit this page regularly to stay informed about how Daily Express uses cookies and similar technologies. The date on this page shows when this notice was last updated.",
    ],
  },
  {
    title: "11. Contact Us",
    body: [
      "If you have questions about this Cookie Notice or how Daily Express uses cookies and similar technologies, contact us at support@dailyexpress.app.",
    ],
  },
];

export default function CookiesPage() {
  return (
    <div className="w-full min-h-screen flex flex-col">
      <div className="bg-white sticky top-0 z-50">
        <Navbar />
      </div>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-16">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-neutral-950">
            Cookie Notice
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
