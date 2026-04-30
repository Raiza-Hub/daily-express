import type { Metadata } from "next";
import type { ApiResponse, Route } from "@shared/types";
import { env } from "~/env";

const WEB_APP_NAME = "Daily Express";
const DEFAULT_WEB_DESCRIPTION =
  "Search Daily Express routes, compare fares, and book intercity trips with confidence.";
const DEFAULT_WEB_APP_URL = env.NEXT_PUBLIC_WEB_APP_URL;
const API_GATEWAY_URL = env.NEXT_PUBLIC_API_GATEWAY_URL;

export const webAppName = WEB_APP_NAME;
export const webAppUrl = new URL(DEFAULT_WEB_APP_URL);

function buildPageTitle(title?: string) {
  return title ? `${title} | ${WEB_APP_NAME}` : WEB_APP_NAME;
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

function formatTravelDate(date?: string) {
  if (!date) {
    return undefined;
  }

  const parsedDate = new Date(`${date}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat("en-NG", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parsedDate);
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(amount);
}

function joinVehicleTypes(vehicleTypes?: string[]) {
  if (!vehicleTypes?.length) {
    return "";
  }

  const labels = vehicleTypes.map((vehicleType) =>
    vehicleType.replaceAll("_", " "),
  );

  if (labels.length === 1) {
    return labels[0] || "";
  }

  return `${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

function normalizeArrayParam(value?: string | string[]) {
  if (!value) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  const normalized = values
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter(Boolean);

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeStringParam(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export function buildWebAbsoluteUrl(path = "/") {
  return new URL(path, webAppUrl).toString();
}

export function buildWebMetadata({
  title,
  description = DEFAULT_WEB_DESCRIPTION,
  path = "/",
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  noIndex?: boolean;
} = {}): Metadata {
  const canonicalUrl = buildWebAbsoluteUrl(path);
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
      siteName: WEB_APP_NAME,
      locale: "en_NG",
      type: "website",
      images: [
        {
          url: buildWebAbsoluteUrl("/opengraph-image"),
          width: 1200,
          height: 630,
          alt: `${WEB_APP_NAME} Open Graph image`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [buildWebAbsoluteUrl("/opengraph-image")],
    },
  };
}

async function fetchSearchRoutePreview(params: {
  from: string;
  to: string;
  date?: string;
  vehicleType?: string[];
}) {
  const searchParams = new URLSearchParams({
    from: params.from,
    to: params.to,
    limit: "3",
    offset: "0",
  });

  if (params.date) {
    searchParams.set("date", params.date);
  }

  if (params.vehicleType?.length) {
    searchParams.set("vehicleType", params.vehicleType.join(","));
  }

  try {
    const response = await fetch(
      `${API_GATEWAY_URL}/api/routes/v1/route/search?${searchParams.toString()}`,
      {
        next: { revalidate: 300 },
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

export async function buildHomeMetadataFromSearchParams(searchParams: {
  from?: string | string[];
  to?: string | string[];
  date?: string | string[];
  vehicleType?: string | string[];
}) {
  const from = normalizeStringParam(searchParams.from)?.trim();
  const to = normalizeStringParam(searchParams.to)?.trim();
  const date = normalizeStringParam(searchParams.date)?.trim();
  const vehicleType = normalizeArrayParam(searchParams.vehicleType);

  if (!from || !to) {
    return buildWebMetadata({
      title: "Find Trips",
      description:
        "Search Daily Express routes and compare available trips across your next destination.",
      path: "/",
    });
  }

  const results = await fetchSearchRoutePreview({ from, to, date, vehicleType });
  const formattedDate = formatTravelDate(date);
  const formattedVehicleType = joinVehicleTypes(vehicleType);
  const routeLabel = `${from} to ${to}`;
  const dateLabel = formattedDate ? ` on ${formattedDate}` : "";
  const vehicleLabel = formattedVehicleType
    ? ` for ${formattedVehicleType} trips`
    : "";
  const canonicalUrl = new URL("/", webAppUrl);

  canonicalUrl.searchParams.set("from", from);
  canonicalUrl.searchParams.set("to", to);

  if (date) {
    canonicalUrl.searchParams.set("date", date);
  }

  if (vehicleType?.length) {
    canonicalUrl.searchParams.set("vehicleType", vehicleType.join(","));
  }

  if (results.length === 0) {
    return buildWebMetadata({
      title: `${routeLabel} Trips`,
      description: `Browse Daily Express availability from ${routeLabel}${dateLabel}${vehicleLabel}. No trips are listed right now, so check nearby dates or adjust your filters.`,
      path: `${canonicalUrl.pathname}${canonicalUrl.search}`,
    });
  }

  const prices = results.map((route) => route.price);
  const lowestPrice = Math.min(...prices);
  const firstTrip = results[0];
  const departureTime = firstTrip
    ? new Intl.DateTimeFormat("en-NG", {
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(firstTrip.departure_time))
    : undefined;
  const descriptionParts = [
    `Browse Daily Express trips from ${routeLabel}${dateLabel}${vehicleLabel}.`,
    `Current fares start from ${formatPrice(lowestPrice)}.`,
  ];

  if (departureTime) {
    descriptionParts.push(`The earliest listed departure starts at ${departureTime}.`);
  }

  return buildWebMetadata({
    title: `${routeLabel} Trips`,
    description: descriptionParts.join(" "),
    path: `${canonicalUrl.pathname}${canonicalUrl.search}`,
  });
}
