import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NOTIFICATION_UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
    NOTIFICATION_UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  },
  client: {
    NEXT_PUBLIC_API_GATEWAY_URL: z
      .string()
      .url()
      .default("http://localhost:8000"),
    NEXT_PUBLIC_DRIVER_APP_URL: z
      .string()
      .url()
      .default("http://localhost:3001"),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().min(1).default("/daily-express-flow"),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_UI_HOST: z
      .string()
      .url()
      .default("https://us.posthog.com"),
    NEXT_PUBLIC_WEB_APP_URL: z.string().url().default("http://localhost:3000"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_API_GATEWAY_URL: process.env.NEXT_PUBLIC_API_GATEWAY_URL,
    NEXT_PUBLIC_DRIVER_APP_URL: process.env.NEXT_PUBLIC_DRIVER_APP_URL,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_UI_HOST: process.env.NEXT_PUBLIC_POSTHOG_UI_HOST,
    NEXT_PUBLIC_WEB_APP_URL: process.env.NEXT_PUBLIC_WEB_APP_URL,
  },
});
