import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CORS_ORIGINS: z
    .string()
    .default(
      "http://localhost:3000,http://localhost:3001,https://dailyexpress.app,https://driver.dailyexpress.app",
    ),
  TRUST_PROXY_HOPS: z.coerce.number().int().nonnegative().default(0),
  ENABLE_PROXY_IP_DEBUG: z
    .preprocess((value) => {
      if (value === undefined || value === "") return false;
      if (typeof value === "string") {
        return ["1", "true", "yes", "on"].includes(value.toLowerCase());
      }
      return value;
    }, z.boolean())
    .default(false),
  PROXY_IP_DEBUG_TOKEN: z
    .preprocess((value) => (value === "" ? undefined : value), z.string().min(1))
    .optional(),
  RATE_LIMIT_PUBLIC_AUTH: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_PUBLIC_ROUTES: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_PROTECTED: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_UPSTASH_REDIS_REST_URL: z
    .preprocess((value) => (value === "" ? undefined : value), z.string().url())
    .optional(),
  RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN: z
    .preprocess((value) => (value === "" ? undefined : value), z.string().min(1))
    .optional(),
  AUTH_SERVICE_URL: z.string().url().default("http://localhost:5001"),
  INTERNAL_SERVICE_TOKEN: z
    .string()
    .min(1)
    .default("daily-express-internal-token"),
  DRIVER_SERVICE_URL: z.string().url().default("http://localhost:5002"),
  ROUTE_SERVICE_URL: z.string().url().default("http://localhost:5004"),
  PAYMENT_SERVICE_URL: z.string().url().default("http://localhost:5005"),
  PAYOUT_SERVICE_URL: z.string().url().default("http://localhost:5006"),
  NOTIFICATION_SERVICE_URL: z.string().url().default("http://localhost:5007"),
});

export type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (config) return config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map(
      (e) => `${e.path.join(".")}: ${e.message}`,
    );
    throw new Error(`Invalid environment configuration:\n${errors.join("\n")}`);
  }

  config = result.data;
  return config;
}

export function getConfig(): EnvConfig {
  if (!config) {
    return loadConfig();
  }
  return config;
}
