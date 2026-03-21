import { GeoPlacesClient } from "@aws-sdk/client-geo-places";
import { Redis } from "@upstash/redis";

const globalForClients = globalThis as unknown as {
  redis?: Redis;
  geoPlacesClient?: GeoPlacesClient;
};

export const getRedis = () => {
  if (globalForClients.redis) return globalForClients.redis;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error("Upstash Redis credentials missing.");
  }

  globalForClients.redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return globalForClients.redis;
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
