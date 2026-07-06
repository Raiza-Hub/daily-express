import { createHmac, timingSafeEqual } from "node:crypto";
import CircuitBreaker from "opossum";
import { getConfig } from "../config/index";
import { logger } from "../utils/logger";
import type {
  KoraInitializeRequest,
  KoraInitializeResponse,
  KoraVerifyResponse,
  KoraRefundRequest,
  KoraRefundResponse,
  KoraResolveAccountResponse,
  KoraBalanceResponse,
  KoraDisburseResponse,
  KoraPayoutHistoryItem,
} from "./payment.types";

interface KoraErrorResponse {
  message: string;
  errors?: unknown;
  error_code?: string;
  data?: Record<string, { message?: string }>;
}

interface KoraApiEnvelope<TData> {
  status?: boolean;
  message?: string;
  error?: string;
  error_code?: string;
  data: TData;
}

function getKoraErrorMessage(
  message: string | undefined,
  fallback: string,
): string {
  return message?.trim() || fallback;
}

export class KoraClient {
  private baseUrl: string;
  private secretKey: string;
  private breaker: CircuitBreaker;

  constructor() {
    const config = getConfig();
    this.baseUrl = config.KORA_BASE_URL;
    this.secretKey = config.KORA_SECRET_KEY;

    this.breaker = new CircuitBreaker(
      async (path: string, options: RequestInit = {}) =>
        this.rawRequest(path, options),
      {
        timeout: config.KORA_TIMEOUT_MS,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        volumeThreshold: 10,
        name: "kora-api",
      },
    );

    this.breaker.on("open", () => logger.warn("kora.circuit_open"));
    this.breaker.on("halfOpen", () => logger.info("kora.circuit_half_open"));
    this.breaker.on("close", () => logger.info("kora.circuit_closed"));
  }

  private async rawRequest<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<{
    data: T;
    raw: KoraApiEnvelope<T>;
  }> {
    const config = getConfig();
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(config.KORA_TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({
        message: response.statusText,
      }))) as KoraErrorResponse;
      const baseMessage = getKoraErrorMessage(
        errorBody.message || response.statusText,
        "Payment provider request failed",
      );
      const detailMessage = errorBody.data
        ? ` (${Object.entries(errorBody.data)
            .map(([field, err]) => `${field}: ${err?.message || "invalid"}`)
            .join("; ")})`
        : "";
      const error = new Error(`${baseMessage}${detailMessage}`);
      (error as any).koraErrorCode = errorBody.error_code || errorBody.error;
      (error as any).koraHttpStatus = response.status;
      (error as any).koraResponseData = errorBody;
      throw error;
    }

    const raw = (await response.json()) as KoraApiEnvelope<T>;
    if (raw.status === false || !raw.data) {
      const error = new Error(
        getKoraErrorMessage(
          raw.message || raw.error,
          "Payment provider request failed",
        ),
      );
      (error as any).koraErrorCode = raw.error_code || raw.error;
      (error as any).koraResponseData = raw;
      throw error;
    }

    return {
      data: raw.data,
      raw,
    };
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<{
    data: T;
    raw: KoraApiEnvelope<T>;
  }> {
    return this.breaker.fire(path, options) as Promise<{
      data: T;
      raw: KoraApiEnvelope<T>;
    }>;
  }

  async initializeTransaction(data: KoraInitializeRequest) {
    return this.request<KoraInitializeResponse>(
      "/merchant/api/v1/charges/initialize",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async verifyTransaction(reference: string) {
    return this.request<KoraVerifyResponse>(
      `/merchant/api/v1/charges/${encodeURIComponent(reference)}`,
    );
  }

  async initiateRefund(data: KoraRefundRequest) {
    return this.request<KoraRefundResponse>(
      "/merchant/api/v1/refunds/initiate",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  }

  async resolveAccountNumber(
    bankCode: string,
    accountNumber: string,
    currency: string,
  ): Promise<{
    data: KoraResolveAccountResponse;
    raw: unknown;
  }> {
    const result = await this.request<KoraResolveAccountResponse>(
      "/merchant/api/v1/misc/banks/resolve",
      {
        method: "POST",
        body: JSON.stringify({
          bank: bankCode,
          account: accountNumber,
          currency,
        }),
      },
    );

    if (!result.data) {
      throw new Error("Kora account resolution failed");
    }

    return { data: result.data, raw: result };
  }

  async initiatePayout(payload: {
    reference: string;
    amount: number;
    currency: string;
    bankCode: string;
    accountNumber: string;
    accountName: string;
    customerEmail: string;
    narration?: string;
  }) {
    return this.request<KoraDisburseResponse>(
      "/merchant/api/v1/transactions/disburse",
      {
        method: "POST",
        body: JSON.stringify({
          reference: payload.reference,
          destination: {
            type: "bank_account",
            amount: payload.amount,
            currency: payload.currency,
            bank_account: {
              bank: payload.bankCode,
              account: payload.accountNumber,
            },
            customer: {
              email: payload.customerEmail,
              name: payload.accountName,
            },
            ...(payload.narration ? { narration: payload.narration } : {}),
          },
        }),
      },
    );
  }

  async getBalance() {
    return this.request<KoraBalanceResponse>("/merchant/api/v1/balances");
  }
  async findPayoutByReference(reference: string) {
    try {
      const response = await this.request<KoraPayoutHistoryItem>(
        `/merchant/api/v1/payouts/${encodeURIComponent(reference)}`,
      );
      return { data: response.data, raw: response.raw };
    } catch {
      return { data: null, raw: null };
    }
  }

  verifyWebhookSignature(
    payload?: Record<string, unknown> | null,
    signature?: string,
  ): boolean {
    if (!payload || !signature) {
      return false;
    }

    const normalizedSignature = signature.trim();
    if (!/^[a-f0-9]{64}$/i.test(normalizedSignature)) {
      return false;
    }

    const expectedSignature = createHmac("sha256", this.secretKey)
      .update(JSON.stringify(payload))
      .digest("hex");

    try {
      return timingSafeEqual(
        Buffer.from(expectedSignature, "hex"),
        Buffer.from(normalizedSignature, "hex"),
      );
    } catch {
      return false;
    }
  }
}

export const koraClient = new KoraClient();
