import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8000),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
  RATE_LIMIT_PUBLIC_AUTH: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_PUBLIC_ROUTES: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_PROTECTED: z.coerce.number().int().positive().default(100),
  AUTH_SERVICE_URL: z.string().url().default("http://localhost:5001"),
  DRIVER_SERVICE_URL: z.string().url().default("http://localhost:5002"),
  ROUTE_SERVICE_URL: z.string().url().default("http://localhost:5004"),
  PAYMENT_SERVICE_URL: z.string().url().default("http://localhost:5005"),
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
