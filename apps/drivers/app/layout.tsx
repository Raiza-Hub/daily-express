import type { Metadata } from "next";
import localFont from "next/font/local";
import "@repo/ui/globals.css";
import Providers from "./components/providers";
import { buildDriverAbsoluteUrl, driverAppName, driverAppUrl } from "./lib/seo";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: driverAppUrl,
  applicationName: driverAppName,
  title: {
    default: driverAppName,
    template: `%s | ${driverAppName}`,
  },
  description:
    "Manage Daily Express routes, monitor trip activity, and stay on top of payouts from one driver dashboard.",
  openGraph: {
    title: driverAppName,
    description:
      "Manage Daily Express routes, monitor trip activity, and stay on top of payouts from one driver dashboard.",
    url: buildDriverAbsoluteUrl("/"),
    siteName: driverAppName,
    locale: "en_NG",
    type: "website",
    images: [
      {
        url: buildDriverAbsoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: `${driverAppName} Open Graph image`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: driverAppName,
    description:
      "Manage Daily Express routes, monitor trip activity, and stay on top of payouts from one driver dashboard.",
    images: [buildDriverAbsoluteUrl("/opengraph-image")],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
