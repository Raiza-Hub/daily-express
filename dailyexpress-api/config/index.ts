import z from "zod/v4";

function optionalUrl() {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  );
}

function optionalString() {
  return z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(1).optional(),
  );
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_CALLBACK_URL: z.string().url(),
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
    .preprocess(
      (value) => (value === "" ? undefined : value),
      z.string().min(1),
    )
    .optional(),
  RATE_LIMIT_PUBLIC_AUTH: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_PUBLIC_ROUTES: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_PROTECTED: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_UPSTASH_REDIS_REST_URL: optionalUrl(),
  RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN: optionalString(),
  NOTIFICATION_UPSTASH_REDIS_REST_URL: optionalUrl(),
  NOTIFICATION_UPSTASH_REDIS_REST_TOKEN: optionalString(),
  KORA_SECRET_KEY: z.string().min(1),
  KORA_BASE_URL: z.string().url().default("https://api.korapay.com"),
  KORA_WEBHOOK_SECRET: z.string().min(1),
  KORA_WEBHOOK_URL: z.string().url().optional(),
  FRONTEND_URL: z.string().url().default("http://localhost:3000"),
  PAYOUT_RETRY_DELAYS_MS: z.string().default("60000,300000,900000"),
  INSUFFICIENT_BALANCE_RETRY_DELAY_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(30 * 60 * 1000),
  PAYOUT_JOB_EXPIRE_MINUTES: z.coerce.number().int().positive().default(15),
  MINIMUM_PAYOUT_BUFFER_MINOR: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(50000),

  // Database
  DATABASE_URL: z.string().min(1),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().min(1),
  CLOUDINARY_API_KEY: z.string().min(1),
  CLOUDINARY_API_SECRET: z.string().min(1),

  // Email (Amazon SES API)
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(1),
  EMAIL_BRAND_NAME: z.string().default("Daily Express"),
  SUPPORT_EMAIL: z.string().default("support@dailyexpress.com"),

  // Auth
  BCRYPT_ROUNDS: z.coerce.number().int().positive().default(10),
  COOKIE_DOMAIN: optionalString(),
  DRIVER_APP_URL: z.string().default("http://localhost:3001"),

  // Payment
  PAYMENT_PUBLIC_BASE_URL: optionalUrl(),
  RATE_LIMIT_WEBHOOK: z.coerce.number().int().positive().default(300),

  // Route
  ROUTE_SERVICE_TIMEZONE: z.string().min(1),

  // Logging
  DAILYEXPRESS_API_LOG_CONSOLE: z
    .preprocess(
      (value) => value === "true" || value === true,
      z.boolean().default(false),
    )
    .default(false),
});

export type EnvConfig = z.infer<typeof envSchema>;

let config: EnvConfig | null = null;

export function loadConfig(): EnvConfig {
  if (config) return config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const errorMessage =
      result.error.message || "Invalid environment configuration";
    throw new Error(`Invalid environment configuration:\n${errorMessage}`);
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
