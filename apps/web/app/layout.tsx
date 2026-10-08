import type { Metadata } from "next";
import { Onest } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { QueryProvider } from "@repo/api";
import { Toaster } from "sonner";
import "./globals.css";

const onest = Onest({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_WEB_APP_URL ?? "https://dailyexpress.app",
  ),
  title: { template: "%s | Beckōn", default: "Beckōn" },
  description: "Get there comfortably, book your trip in seconds.",
  openGraph: {
    type: "website",
    siteName: "Beckōn",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={onest.variable}>
      <body className="flex min-h-dvh flex-col antialiased font-sans">
        <NuqsAdapter>
          <QueryProvider>
            {children}
            <Toaster position="top-right" richColors />
          </QueryProvider>
        </NuqsAdapter>
      </body>
    </html>
  );
}