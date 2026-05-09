import { createHmac, timingSafeEqual } from "node:crypto";
import { getConfig } from "../config/index";
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
}

interface KoraApiEnvelope<TData> {
  status?: boolean;
  message?: string;
  error?: string;
  error_code?: string;
  data: TData;
}

export class KoraClient {
  private baseUrl: string;
  private secretKey: string;

  constructor() {
    const config = getConfig();
    this.baseUrl = config.KORA_BASE_URL;
    this.secretKey = config.KORA_SECRET_KEY;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<{
    data: T;
    raw: KoraApiEnvelope<T>;
  }> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorBody = (await response.json().catch(() => ({
        message: `HTTP ${response.status}: ${response.statusText}`,
      }))) as KoraErrorResponse;
      const error = new Error(
        `Kora API error: ${errorBody.message || response.statusText}`,
      );
      (error as any).koraErrorCode = errorBody.error_code;
      (error as any).koraHttpStatus = response.status;
      (error as any).koraResponseData = errorBody;
      throw error;
    }

    const raw = (await response.json()) as KoraApiEnvelope<T>;
    if (raw.status === false || !raw.data) {
      const error = new Error(raw.message || raw.error || "Kora request failed");
      (error as any).koraErrorCode = raw.error_code;
      (error as any).koraResponseData = raw;
      throw error;
    }

    return {
      data: raw.data,
      raw,
    };
  }

  async initializeTransaction(
    data: KoraInitializeRequest,
  ) {
    return this.request<KoraInitializeResponse>("/merchant/api/v1/charges/initialize", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async verifyTransaction(reference: string) {
    return this.request<KoraVerifyResponse>(
      `/merchant/api/v1/charges/${encodeURIComponent(reference)}`,
    );
  }

  async initiateRefund(data: KoraRefundRequest) {
    return this.request<KoraRefundResponse>("/merchant/api/v1/refunds/initiate", {
      method: "POST",
      body: JSON.stringify(data),
    });
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
          merchant_bears_cost: false,
        }),
      },
    );
  }

  async getBalance() {
    return this.request<KoraBalanceResponse>("/merchant/api/v1/balances");
  }

  private normalizePayoutHistoryItems(data: unknown): KoraPayoutHistoryItem[] {
    if (Array.isArray(data)) {
      return data.filter(
        (item): item is KoraPayoutHistoryItem =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as KoraPayoutHistoryItem).reference === "string",
      );
    }

    if (
      data &&
      typeof data === "object" &&
      Array.isArray((data as { data?: unknown[] }).data)
    ) {
      return this.normalizePayoutHistoryItems(
        (data as { data?: unknown[] }).data,
      );
    }

    if (
      data &&
      typeof data === "object" &&
      typeof (data as KoraPayoutHistoryItem).reference === "string"
    ) {
      return [data as KoraPayoutHistoryItem];
    }

    return [];
  }

  async findPayoutByReference(reference: string) {
    const response = await this.request<unknown>(
      "/merchant/api/v1/payouts?limit=100",
    );

    const payout = this.normalizePayoutHistoryItems(response.data).find(
      (item) => item.reference === reference,
    );

    return {
      data: payout || null,
      raw: response.raw,
    };
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
