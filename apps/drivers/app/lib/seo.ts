import type { Metadata } from "next";
import { env } from "~/env";

const DRIVER_APP_NAME = "Daily Express Driver";
const DEFAULT_DRIVER_DESCRIPTION =
  "Manage Daily Express routes, monitor trip activity, and stay on top of payouts from one driver dashboard.";
const DEFAULT_DRIVER_APP_URL = env.NEXT_PUBLIC_DRIVER_APP_URL;
export const driverAppName = DRIVER_APP_NAME;
export const driverAppUrl = new URL(DEFAULT_DRIVER_APP_URL);

function buildPageTitle(title?: string) {
  return title ? `${title} | ${DRIVER_APP_NAME}` : DRIVER_APP_NAME;
}

function buildRobots(noIndex?: boolean): Metadata["robots"] | undefined {
  if (!noIndex) {
    return undefined;
  }

  return {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  };
}

export function buildDriverAbsoluteUrl(path = "/") {
  return new URL(path, driverAppUrl).toString();
}

export function buildDriverMetadata({
  title,
  description = DEFAULT_DRIVER_DESCRIPTION,
  path = "/",
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
} = {}): Metadata {
  const canonicalUrl = buildDriverAbsoluteUrl(path);
  const fullTitle = buildPageTitle(title);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: buildRobots(noIndex),
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: DRIVER_APP_NAME,
      locale: "en_NG",
      type: "website",
      images: [
        {
          url: buildDriverAbsoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: `${DRIVER_APP_NAME} Open Graph image`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [buildDriverAbsoluteUrl("/opengraph-image")],
    },
  };
}


