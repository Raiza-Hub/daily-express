import type { KoraCheckoutChannel } from "@shared/types";
import type { DbTransaction } from "../db/connection";

export type PaymentTransaction = DbTransaction;

export type PaymentStatus =
  | "initialized"
  | "pending"
  | "processing"
  | "successful"
  | "failed"
  | "cancelled"
  | "expired";

export type KoraChannel = KoraCheckoutChannel;

export interface InitializePaymentInput {
  bookingId: string;
  reference?: string;
  currency?: string;
  channels?: KoraChannel[];
  productName: string;
  customerName?: string;
  metadata?: Record<string, unknown>;
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
  narration?: string;
  merchant_bears_cost?: boolean;
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
  bank_transfer?: {
    payer_bank_account?: {
      bank_name: string;
      account_number: string;
      account_name: string;
    };
  };
}

export interface KoraBank {
  name: string;
  slug: string;
  code: string;
  country: string;
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
    paid_at?: string | null;
    customer?: {
      email?: string | null;
    };
    metadata?: Record<string, unknown> | null;
    payment_reference?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface KoraRefundRequest {
  reference: string;
  payment_reference: string;
  amount: number;
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

export interface KoraResolveAccountResponse {
  bank_name: string;
  bank_code: string;
  account_number: string;
  account_name: string;
}

export interface KoraDisburseResponse {
  amount: string;
  fee: string;
  currency: string;
  status: string;
  reference: string;
  narration?: string;
  message?: string;
  customer: {
    name: string;
    email: string;
    phone?: string | null;
  };
}

export interface KoraPayoutHistoryItem {
  pointer?: string;
  reference: string;
  status: string;
  amount?: number | string;
  fee?: number | string;
  currency?: string;
  message?: string;
  narration?: string;
  customer_name?: string;
  customer_email?: string;
  date_created?: string;
  date_completed?: string | null;
}

export interface KoraBalanceResponse {
  NGN?: {
    available_balance: string;
    pending_balance: string;
    issuing_balance?: string;
  };
  [currency: string]:
    | {
        available_balance: string;
        pending_balance: string;
        issuing_balance?: string;
      }
    | undefined;
}

export interface KoraPayoutWebhookPayload {
  event: string;
  data: {
    amount: number | string;
    fee: number | string;
    currency: string;
    status: string;
    reference: string;
    message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
