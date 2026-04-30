import { createHmac, timingSafeEqual } from "node:crypto";
import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";
import axios, { AxiosError, type AxiosInstance } from "axios";
import { createServiceError } from "@shared/utils";
import { loadConfig } from "./config";
import type {
  KoraInitializeRequest,
  KoraInitializeResponse,
  KoraRefundRequest,
  KoraRefundResponse,
  KoraVerifyResponse,
  PaymentStatus,
} from "./types";

interface KoraApiEnvelope<TData> {
  status: boolean;
  message: string;
  data?: TData;
}

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

export function mapKoraStatusToPaymentStatus(
  status?: string,
): PaymentStatus | null {
  switch (status?.toLowerCase()) {
    case "success":
      return "successful";
    case "failed":
      return "failed";
    case "abandoned":
    case "cancelled":
      return "cancelled";
    case "processing":
    case "pending":
      return "pending";
    default:
      return null;
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
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });
  }

  private ensureSecretAuth() {
    if (!this.config.koraSecretKey) {
      throw createServiceError("Kora secret key is not configured", 500);
    }
  }

  verifyWebhookSignature(
    data?: Record<string, unknown>,
    signature?: string,
  ): boolean {
    const secret = this.config.koraSecretKey;

    if (!secret || !data || !signature) {
      return false;
    }

    const generatedSignature = createHmac("sha256", secret)
      .update(JSON.stringify(data))
      .digest("hex");

    try {
      return timingSafeEqual(
        Buffer.from(generatedSignature, "hex"),
        Buffer.from(signature, "hex"),
      );
    } catch {
      return false;
    }
  }

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<{
    data: T;
    raw: KoraApiEnvelope<T>;
  }> {
    this.ensureSecretAuth();

    try {
      const response =
        method === "GET"
          ? await this.http.get<KoraApiEnvelope<T>>(path, {
              headers: {
                Authorization: `Bearer ${this.config.koraSecretKey}`,
              },
            })
          : await this.http.post<KoraApiEnvelope<T>>(path, body, {
              headers: {
                Authorization: `Bearer ${this.config.koraSecretKey}`,
              },
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
      throw createServiceError(
        getKoraErrorMessage(error, "Kora request failed"),
        502,
      );
    }
  }

  async initializeTransaction(payload: KoraInitializeRequest) {
    return this.request<KoraInitializeResponse>(
      "POST",
      "/merchant/api/v1/charges/initialize",
      payload,
    );
  }

  async verifyTransaction(reference: string) {
    return this.request<KoraVerifyResponse>(
      "GET",
      `/merchant/api/v1/charges/${encodeURIComponent(reference)}`,
    );
  }

  async initiateRefund(payload: KoraRefundRequest) {
    return this.request<KoraRefundResponse>(
      "POST",
      "/merchant/api/v1/refunds/initiate",
      payload,
    );
  }
}

export const koraClient = new KoraClient();
