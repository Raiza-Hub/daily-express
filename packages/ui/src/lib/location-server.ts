import { createHash } from "node:crypto";
import { GetPlaceCommand, SuggestCommand } from "@aws-sdk/client-geo-places";
import type { AWSPlaceDetails } from "@repo/types";
import type { LocationSuggestion } from "../components/location-dropdown";
import {
  getGeoPlacesClient,
  getLocationPlaceRateLimiter,
  getLocationSuggestRateLimiter,
  getRedis,
} from "./location-client";

const SEARCH_BIAS_POSITION: [number, number] = [8.6753, 9.082];
const PLACE_CACHE_SECONDS = 60 * 60 * 24 * 30;

type RequestIdentity = {
  ip?: string | null;
  token?: string | null;
  refreshToken?: string | null;
  userId?: string | null;
};

type JwtPayload = {
  userId?: unknown;
};

export class LocationRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Too many location searches. Please wait a moment and try again.");
    this.name = "LocationRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function normalizeCacheKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function decodeJwtPayload(token?: string | null): JwtPayload | null {
  if (!token) {
    return null;
  }

  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  try {
    const decoded = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

export function buildLocationRequesterId(identity: RequestIdentity) {
  const tokenPayload =
    decodeJwtPayload(identity.token) ?? decodeJwtPayload(identity.refreshToken);
  const userId =
    identity.userId ??
    (typeof tokenPayload?.userId === "string" ? tokenPayload.userId : null);

  if (userId) {
    return `user:${userId}`;
  }

  if (identity.token || identity.refreshToken) {
    return `token:${normalizeCacheKey(identity.token ?? identity.refreshToken ?? "")}`;
  }

  if (identity.ip) {
    return `ip:${identity.ip}`;
  }

  return "anonymous";
}

async function applyRateLimit(
  requesterId: string,
  getLimiter: typeof getLocationSuggestRateLimiter,
) {
  const limiter = getLimiter();

  if (!limiter) {
    return;
  }

  const result = await limiter.limit(requesterId);

  if (!result.success) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((result.reset - Date.now()) / 1000),
    );
    throw new LocationRateLimitError(retryAfterSeconds);
  }
}

export async function suggestLocationsForRequester(
  query: string,
  requesterId: string,
): Promise<LocationSuggestion[]> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    return [];
  }

  await applyRateLimit(requesterId, getLocationSuggestRateLimiter);

  const client = getGeoPlacesClient();
  const command = new SuggestCommand({
    QueryText: normalizedQuery,
    MaxResults: 5,
    BiasPosition: SEARCH_BIAS_POSITION,
  });
  const response = await client.send(command);
  const suggestions: LocationSuggestion[] = (response.ResultItems || [])
    .map((item) => ({
      placeId: item.Place?.PlaceId || "",
      title: item.Title || "Unknown Location",
      label: item.Place?.Address?.Label || "Unknown Location",
    }))
    .filter((suggestion) => suggestion.placeId !== "");

  return suggestions;
}

export async function getPlaceDetailsForRequester(
  placeId: string,
  requesterId: string,
): Promise<AWSPlaceDetails | null> {
  if (!placeId) {
    return null;
  }

  await applyRateLimit(requesterId, getLocationPlaceRateLimiter);

  const cacheKey = `location:place:${placeId}`;
  const redis = getRedis();

  if (redis) {
    const cached = await redis.get<AWSPlaceDetails>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const client = getGeoPlacesClient();
  const response = (await client.send(
    new GetPlaceCommand({
      PlaceId: placeId,
    }),
  )) as AWSPlaceDetails;

  if (redis && response) {
    await redis.set(cacheKey, response, {
      ex: PLACE_CACHE_SECONDS,
    });
  }

  return response;
}
