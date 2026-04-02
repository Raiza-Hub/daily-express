export interface PaymentServiceConfig {
  port: number;
  nodeEnv: string;
  paystackSecretKey?: string;
  paystackBaseUrl: string;
  paystackRequestTimeoutMs: number;
  defaultRedirectUrl?: string;
  defaultCancelUrl?: string;
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
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
    paystackBaseUrl: process.env.PAYSTACK_BASE_URL || "https://api.paystack.co",
    paystackRequestTimeoutMs: parseInteger(
      process.env.PAYSTACK_TIMEOUT_MS,
      15000,
    ),
    defaultRedirectUrl: process.env.PAYMENT_DEFAULT_REDIRECT_URL,
    defaultCancelUrl: process.env.PAYMENT_DEFAULT_CANCEL_URL,
  };

  return config;
}
