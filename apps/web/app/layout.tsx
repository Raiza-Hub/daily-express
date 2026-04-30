import type { Metadata } from "next";
import localFont from "next/font/local";
import "@repo/ui/styles/globals.css";
import Providers from "./components/providers";
import { buildWebAbsoluteUrl, webAppName, webAppUrl } from "./lib/seo";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: webAppUrl,
  applicationName: webAppName,
  title: {
    default: webAppName,
    template: `%s | ${webAppName}`,
  },
  description:
    "Search Daily Express routes, compare fares, and book intercity trips with confidence.",
  openGraph: {
    title: webAppName,
    description:
      "Search Daily Express routes, compare fares, and book intercity trips with confidence.",
    url: buildWebAbsoluteUrl("/"),
    siteName: webAppName,
    locale: "en_NG",
    type: "website",
    images: [
      {
        url: buildWebAbsoluteUrl("/opengraph-image"),
        width: 1200,
        height: 630,
        alt: `${webAppName} Open Graph image`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: webAppName,
    description:
      "Search Daily Express routes, compare fares, and book intercity trips with confidence.",
    images: [buildWebAbsoluteUrl("/opengraph-image")],
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
