import type { Metadata } from "next";
import { cookies } from "next/headers";
import type { ApiResponse, Route } from "@shared/types";
import { env } from "~/env";

const DRIVER_APP_NAME = "Daily Express Driver";
const DEFAULT_DRIVER_DESCRIPTION =
  "Manage Daily Express routes, monitor trip activity, and stay on top of payouts from one driver dashboard.";
const DEFAULT_DRIVER_APP_URL = env.NEXT_PUBLIC_DRIVER_APP_URL;
const API_GATEWAY_URL = env.NEXT_PUBLIC_API_GATEWAY_URL;

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

export async function getDriverRoutesForMetadata() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");

  if (!cookieHeader) {
    return [];
  }

  try {
    const response = await fetch(
      `${API_GATEWAY_URL}/api/routes/v1/route/driver/routes`,
      {
        headers: {
          Cookie: cookieHeader,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as ApiResponse<Route[]>;

    return payload.success && payload.data ? payload.data : [];
  } catch {
    return [];
  }
}

export async function buildDriverRoutesMetadata() {
  const routes = await getDriverRoutesForMetadata();

  if (routes.length === 0) {
    return buildDriverMetadata({
      title: "My Routes",
      description:
        "Review, update, and publish the routes you have created in Daily Express Driver.",
      path: "/routes",
      noIndex: true,
    });
  }

  const activeCount = routes.filter((route) => route.status === "active").length;
  const firstRoute = routes[0];
  const primaryRoute = firstRoute
    ? `${firstRoute.pickup_location_title} to ${firstRoute.dropoff_location_title}`
    : "your routes";
  const routeLabel = `${routes.length} route${routes.length === 1 ? "" : "s"}`;
  const description =
    activeCount > 0
      ? `Manage ${routeLabel} in Daily Express Driver, including ${primaryRoute}. ${activeCount} ${activeCount === 1 ? "route is" : "routes are"} currently active.`
      : `Manage ${routeLabel} in Daily Express Driver, including ${primaryRoute}, and keep each listing ready for new bookings.`;

  return buildDriverMetadata({
    title: "My Routes",
    description,
    path: "/routes",
    noIndex: true,
  });
}
