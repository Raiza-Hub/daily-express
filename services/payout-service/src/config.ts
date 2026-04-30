export interface PayoutServiceConfig {
  port: number;
  nodeEnv: string;
  koraSecretKey?: string;
  koraBaseUrl: string;
  koraWebhookSecret?: string;
  koraRequestTimeoutMs: number;
  payoutRetryDelaysMs: number[];
  insufficientBalanceRetryDelayMs: number;
  payoutJobExpireMinutes: number;
  minimumPayoutBufferMinor: number;
}

let config: PayoutServiceConfig | null = null;

function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDelayString(
  value: string | undefined,
  fallback: number[],
): number[] {
  if (!value) {
    return fallback;
  }
  return value.split(",").map((n) => parseInteger(n.trim(), 0));
}

export function loadConfig(): PayoutServiceConfig {
  if (config) {
    return config;
  }

  config = {
    port: parseInteger(process.env.PORT, 5006),
    nodeEnv: process.env.NODE_ENV || "development",
    koraSecretKey: process.env.KORA_SECRET_KEY,
    koraBaseUrl: process.env.KORA_BASE_URL || "https://api.korapay.com",
    koraWebhookSecret: process.env.KORA_WEBHOOK_SECRET,
    koraRequestTimeoutMs: parseInteger(process.env.KORA_TIMEOUT_MS, 15000),
    payoutRetryDelaysMs: parseDelayString(
      process.env.PAYOUT_RETRY_DELAYS_MS,
      [60_000, 300_000, 900_000],
    ),
    insufficientBalanceRetryDelayMs: parseInteger(
      process.env.INSUFFICIENT_BALANCE_RETRY_DELAY_MS,
      30 * 60_000,
    ),
    payoutJobExpireMinutes: parseInteger(
      process.env.PAYOUT_JOB_EXPIRE_MINUTES,
      15,
    ),
    minimumPayoutBufferMinor: parseInteger(
      process.env.MINIMUM_PAYOUT_BUFFER_MINOR,
      50_000,
    ),
  };

  return config;
}
