export interface PaymentServiceConfig {
  port: number;
  nodeEnv: string;
  koraSecretKey?: string;
  koraBaseUrl: string;
  koraWebhookSecret?: string;
  koraRequestTimeoutMs: number;
  koraWebhookUrl?: string;
  frontendUrl: string;
  paymentPublicBaseUrl?: string;
}

let config: PaymentServiceConfig | null = null;

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): PaymentServiceConfig {
  if (config) {
    return config;
  }

  config = {
    port: parseInteger(process.env.PORT, 5005),
    nodeEnv: process.env.NODE_ENV || "development",
    koraSecretKey: process.env.KORA_SECRET_KEY,
    koraBaseUrl: process.env.KORA_BASE_URL || "https://api.korapay.com",
    koraWebhookSecret: process.env.KORA_WEBHOOK_SECRET,
    koraRequestTimeoutMs: parseInteger(process.env.KORA_TIMEOUT_MS, 15000),
    koraWebhookUrl: process.env.KORA_WEBHOOK_URL,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000",
    paymentPublicBaseUrl: process.env.PAYMENT_PUBLIC_BASE_URL,
  };

  return config;
}
