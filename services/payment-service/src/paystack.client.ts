import axios, { AxiosError, type AxiosInstance } from "axios";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createServiceError } from "@shared/utils";
import { loadConfig } from "./config";
import type {
  PaystackInitializeRequest,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
  PaymentStatus,
} from "./types";

interface PaystackApiEnvelope<TData> {
  status: boolean;
  message: string;
  data?: TData;
}

function getPaystackErrorMessage(error: unknown, fallback: string) {
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

export function mapPaystackStatusToPaymentStatus(status?: string): PaymentStatus {
  switch (status?.toLowerCase()) {
    case "success":
      return "successful";
    case "failed":
    case "reversed":
      return "failed";
    case "abandoned":
      return "cancelled";
    case "ongoing":
    case "pending":
    case "processing":
    case "queued":
      return "pending";
    default:
      return "initialized";
  }
}

export function verifyPaystackWebhookSignature(input: {
  rawBody?: Buffer;
  signature?: string;
  secret: string;
}): boolean {
  if (!input.rawBody || !input.signature) {
    return false;
  }

  const generatedSignature = createHmac("sha512", input.secret)
    .update(input.rawBody)
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

export class PaystackClient {
  private readonly http: AxiosInstance;
  private readonly config = loadConfig();

  constructor() {
    this.http = axios.create({
      baseURL: this.config.paystackBaseUrl,
      timeout: this.config.paystackRequestTimeoutMs,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });
  }

  private ensureSecretAuth() {
    if (!this.config.paystackSecretKey) {
      throw createServiceError("Paystack secret key is not configured", 500);
    }
  }

  async initializeTransaction(
    payload: PaystackInitializeRequest,
  ): Promise<{
    data: PaystackInitializeResponse;
    raw: PaystackApiEnvelope<PaystackInitializeResponse>;
  }> {
    this.ensureSecretAuth();

    try {
      const response = await this.http.post<
        PaystackApiEnvelope<PaystackInitializeResponse>
      >("/transaction/initialize", payload, {
        headers: {
          Authorization: `Bearer ${this.config.paystackSecretKey}`,
        },
      });

      if (!response.data.status || !response.data.data) {
        throw createServiceError(
          response.data.message || "Failed to initialize Paystack payment",
          502,
        );
      }

      return {
        data: response.data.data,
        raw: response.data,
      };
    } catch (error) {
      throw createServiceError(
        getPaystackErrorMessage(error, "Failed to initialize Paystack payment"),
        502,
      );
    }
  }

  async verifyTransaction(
    reference: string,
  ): Promise<{
    data: PaystackVerifyResponse;
    raw: PaystackApiEnvelope<PaystackVerifyResponse>;
  }> {
    this.ensureSecretAuth();

    try {
      const response = await this.http.get<PaystackApiEnvelope<PaystackVerifyResponse>>(
        `/transaction/verify/${encodeURIComponent(reference)}`,
        {
          headers: {
            Authorization: `Bearer ${this.config.paystackSecretKey}`,
          },
        },
      );

      if (!response.data.status || !response.data.data) {
        throw createServiceError(
          response.data.message || "Failed to verify Paystack payment",
          502,
        );
      }

      return {
        data: response.data.data,
        raw: response.data,
      };
    } catch (error) {
      throw createServiceError(
        getPaystackErrorMessage(error, "Failed to verify Paystack payment"),
        502,
      );
    }
  }
}
