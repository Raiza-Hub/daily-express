import type { Metadata } from "next";
import { env } from "~/env";

const WEB_APP_NAME = "Daily Express";
const DEFAULT_WEB_DESCRIPTION =
  "Search Daily Express routes, compare fares, and book intercity trips with confidence.";
const DEFAULT_WEB_APP_URL = env.NEXT_PUBLIC_WEB_APP_URL;
const WEB_BRAND_LOGO_PREVIEW_PATH = "/opengraph-image?v=20260514-logo-card";

export const webAppName = WEB_APP_NAME;
export const webAppUrl = new URL(DEFAULT_WEB_APP_URL);

function buildPageTitle(title?: string) {
  return title ? `${title} | ${WEB_APP_NAME}` : WEB_APP_NAME;
}

export function buildWebAbsoluteUrl(path = "/") {
  return new URL(path, webAppUrl).toString();
}

export function buildWebBrandLogoPreviewUrl() {
  return buildWebAbsoluteUrl(WEB_BRAND_LOGO_PREVIEW_PATH);
}

export function buildWebMetadata({
  title,
  description = DEFAULT_WEB_DESCRIPTION,
  path = "/",
}: {
  title?: string;
  description?: string;
  path?: string;
} = {}): Metadata {
  const canonicalUrl = buildWebAbsoluteUrl(path);
  const fullTitle = buildPageTitle(title);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: canonicalUrl,
      siteName: WEB_APP_NAME,
      locale: "en_NG",
      type: "website",
      images: [
        {
          url: buildWebBrandLogoPreviewUrl(),
          width: 1200,
          height: 630,
          alt: `${WEB_APP_NAME} logo`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [buildWebBrandLogoPreviewUrl()],
    },
  };
}
