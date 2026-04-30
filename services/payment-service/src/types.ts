import type { KoraCheckoutChannel } from "@shared/types";

export type PaymentStatus =
  | "initialized"
  | "pending"
  | "successful"
  | "failed"
  | "cancelled"
  | "expired"
  | "refund_pending"
  | "refunded"
  | "refund_failed";

export type KoraChannel = KoraCheckoutChannel;

export interface InitializePaymentInput {
  bookingId: string;
  reference?: string;
  currency?: string;
  channels?: KoraChannel[];
  productName: string;
  productDescription: string;
  customerName?: string;
  customerMobile?: string;
  metadata?: Record<string, unknown>;
}

export interface UpsertBookingHoldInput {
  bookingId: string;
  tripId: string;
  userId: string;
  fareAmount: number;
  currency: string;
  expiresAt: string;
}

export interface KoraInitializeRequest {
  customer: {
    email: string;
    name?: string;
  };
  amount: number;
  reference: string;
  currency: string;
  redirect_url: string;
  notification_url?: string;
  narration: string;
  channels?: KoraChannel[];
  metadata?: Record<string, unknown>;
}

export interface KoraInitializeResponse {
  checkout_url: string;
  reference: string;
}

export interface KoraVerifyResponse {
  reference: string;
  status: string;
  amount: number | string;
  amount_paid?: number | string;
  currency: string;
  message?: string;
  paid_at?: string | null;
  transaction_date?: string | null;
  payment_method?: string;
  payment_reference?: string | null;
  metadata?: Record<string, unknown> | null;
  customer?: {
    email?: string | null;
  };
}

export interface KoraWebhookPayload {
  event: string;
  data: {
    status: string;
    reference: string;
    amount: number | string;
    fee?: number | string;
    currency: string;
    payment_method?: string;
    metadata?: Record<string, unknown> | null;
    payment_reference?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface KoraRefundRequest {
  reference: string;
  payment_reference: string;
  reason: string;
}

export interface KoraRefundResponse {
  reference: string;
  payment_reference: string;
  status: "processing" | "success" | "failed";
  amount?: number | string;
  currency?: string;
  created_at?: string;
  completed_at?: string | null;
}
