import { GeoPlacesClient } from "@aws-sdk/client-geo-places";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const globalForClients = globalThis as unknown as {
  redis?: Redis;
  geoPlacesClient?: GeoPlacesClient;
  locationSuggestRateLimiter?: Ratelimit;
  locationPlaceRateLimiter?: Ratelimit;
};

export const getRedis = () => {
  if (globalForClients.redis) return globalForClients.redis;

  if (!process.env.LOCATION_UPSTASH_REDIS_REST_URL || !process.env.LOCATION_UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  globalForClients.redis = new Redis({
    url: process.env.LOCATION_UPSTASH_REDIS_REST_URL,
    token: process.env.LOCATION_UPSTASH_REDIS_REST_TOKEN,
  });

  return globalForClients.redis;
};

function getPositiveIntEnv(name: string, fallback: number) {
  const rawValue = process.env[name];
  const parsedValue = Number(rawValue);

  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

export function getBooleanEnv(name: string, fallback: boolean) {
  const rawValue = process.env[name];

  if (rawValue === undefined) {
    return fallback;
  }

  const normalizedValue = rawValue.trim().toLowerCase();

  if (["1", "true", "yes", "on"].includes(normalizedValue)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalizedValue)) {
    return false;
  }

  return fallback;
}

export const getLocationSuggestRateLimiter = () => {
  if (globalForClients.locationSuggestRateLimiter) {
    return globalForClients.locationSuggestRateLimiter;
  }

  const redis = getRedis();

  if (!redis) {
    return null;
  }

  globalForClients.locationSuggestRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      getPositiveIntEnv("UPSTASH_LOCATION_SUGGEST_LIMIT", 500),
      "1 m",
    ),
    prefix: "ratelimit:location:suggest",
    analytics: false,
  });

  return globalForClients.locationSuggestRateLimiter;
};

export const getLocationPlaceRateLimiter = () => {
  if (globalForClients.locationPlaceRateLimiter) {
    return globalForClients.locationPlaceRateLimiter;
  }

  const redis = getRedis();

  if (!redis) {
    return null;
  }

  globalForClients.locationPlaceRateLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      getPositiveIntEnv("UPSTASH_LOCATION_PLACE_LIMIT", 500),
      "1 m",
    ),
    prefix: "ratelimit:location:place",
    analytics: false,
  });

  return globalForClients.locationPlaceRateLimiter;
};

export const getGeoPlacesClient = () => {
  if (globalForClients.geoPlacesClient) return globalForClients.geoPlacesClient;

  if (!process.env.AWS_REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    throw new Error("AWS credentials missing.");
  }

  globalForClients.geoPlacesClient = new GeoPlacesClient({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });

  return globalForClients.geoPlacesClient;
};
