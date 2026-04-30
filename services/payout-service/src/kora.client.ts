import axios, { AxiosError, type AxiosInstance } from "axios";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceError } from "@shared/utils";
import { sentryServer } from "@shared/sentry";
import { loadConfig } from "./config";
import type {
  KoraApiEnvelope,
  KoraResolveAccountResponse,
  KoraDisburseResponse,
  KoraBalanceResponse,
  KoraPayoutHistoryItem,
} from "./types";

const sharedHttpAgent = new HttpAgent({
  keepAlive: true,
});

const sharedHttpsAgent = new HttpsAgent({
  keepAlive: true,
});

function getKoraErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{
      message?: string;
      error?: string;
      error_code?: string;
    }>;

    return (
      axiosError.response?.data?.message ||
      axiosError.response?.data?.error ||
      axiosError.message ||
      fallback
    );
  }

  return error instanceof Error ? error.message : fallback;
}

export const KORA_ERROR_CODES = {
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
  INVALID_ACCOUNT: "INVALID_ACCOUNT",
  BANK_PROCESSING_ERROR: "BANK_PROCESSING_ERROR",
  DUPLICATE_REFERENCE: "DUPLICATE_REFERENCE",
} as const;

export const RETRYABLE_KORA_ERRORS = new Set<string>([
  KORA_ERROR_CODES.BANK_PROCESSING_ERROR,
]);

export const FATAL_KORA_ERRORS = new Set<string>([
  KORA_ERROR_CODES.INVALID_ACCOUNT,
  KORA_ERROR_CODES.DUPLICATE_REFERENCE,
]);

export function isRetryableKoraError(errorCode?: string): boolean {
  return errorCode ? RETRYABLE_KORA_ERRORS.has(errorCode) : false;
}

export function isFatalKoraError(errorCode?: string): boolean {
  return errorCode ? FATAL_KORA_ERRORS.has(errorCode) : false;
}

export function verifyKoraWebhookSignature(input: {
  rawBody?: Buffer;
  signature?: string;
  secret: string;
}): boolean {
  if (!input.rawBody || !input.signature) {
    return false;
  }

  const payload = JSON.parse(input.rawBody.toString());
  const dataString = JSON.stringify(payload.data);

  const generatedSignature = createHmac("sha256", input.secret)
    .update(dataString)
    .digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(generatedSignature, "hex"),
      Buffer.from(input.signature, "hex"),
    );
  } catch {
    return false;
  }
}

export class KoraClient {
  private readonly http: AxiosInstance;
  private readonly config = loadConfig();

  constructor() {
    this.http = axios.create({
      baseURL: this.config.koraBaseUrl,
      timeout: this.config.koraRequestTimeoutMs,
      httpAgent: sharedHttpAgent,
      httpsAgent: sharedHttpsAgent,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  private ensureSecretAuth() {
    if (!this.config.koraSecretKey) {
      throw createServiceError("Kora secret key is not configured", 500);
    }
  }

  private async request<TData>(
    method: "get" | "post",
    url: string,
    payload?: unknown,
    params?: Record<string, string | number>,
  ) {
    this.ensureSecretAuth();

    try {
      const response =
        method === "get"
          ? await this.http.get<KoraApiEnvelope<TData>>(url, {
              headers: {
                Authorization: `Bearer ${this.config.koraSecretKey}`,
              },
              params,
            })
          : await this.http.post<KoraApiEnvelope<TData>>(url, payload, {
              headers: {
                Authorization: `Bearer ${this.config.koraSecretKey}`,
              },
              params,
            });

      if (!response.data.status || !response.data.data) {
        throw createServiceError(
          response.data.message || "Kora request failed",
          502,
        );
      }

      return {
        data: response.data.data,
        raw: response.data,
      };
    } catch (error) {
      sentryServer.captureException(error, "unknown", {
        action: "koraClient_request",
        values: { method, url, params },
      });
      let errorCode = (error as { koraErrorCode?: string } | undefined)
        ?.koraErrorCode;

      if (!errorCode && axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<{
          message?: string;
          error?: string;
          error_code?: string;
        }>;
        errorCode = axiosError.response?.data?.error_code;
      }

      const serviceError = createServiceError(
        getKoraErrorMessage(error, "Kora request failed"),
        502,
      );

      if (errorCode) {
        (serviceError as any).koraErrorCode = errorCode;
      }

      if (axios.isAxiosError(error)) {
        (serviceError as any).koraHttpStatus = error.response?.status;
        (serviceError as any).koraResponseData = error.response?.data;
        (serviceError as any).koraNetworkError = !error.response;
      }

      throw serviceError;
    }
  }

  private normalizePayoutHistoryItems(
    data: unknown,
  ): KoraPayoutHistoryItem[] {
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

  async resolveAccountNumber(
    bankCode: string,
    accountNumber: string,
    currency: string,
  ) {
    return this.request<KoraResolveAccountResponse>(
      "post",
      "/merchant/api/v1/misc/banks/resolve",
      {
        bank: bankCode,
        account: accountNumber,
        currency,
      },
    );
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
      "post",
      "/merchant/api/v1/transactions/disburse",
      {
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
      },
    );
  }

  async getBalance() {
    return this.request<KoraBalanceResponse>(
      "get",
      "/merchant/api/v1/balances",
    );
  }

  async findPayoutByReference(reference: string) {
    const response = await this.request<unknown>(
      "get",
      "/merchant/api/v1/payouts",
      undefined,
      { limit: 100 },
    );

    const payout = this.normalizePayoutHistoryItems(response.data).find(
      (item) => item.reference === reference,
    );

    return {
      data: payout || null,
      raw: response.raw,
    };
  }
}
