export type PaymentStatus =
  | "initialized"
  | "pending"
  | "successful"
  | "failed"
  | "cancelled"
  | "expired";

export type PaystackChannel =
  | "card"
  | "bank"
  | "apple_pay"
  | "ussd"
  | "qr"
  | "mobile_money"
  | "bank_transfer"
  | "eft"
  | "capitec_pay"
  | "payattitude";

export interface InitializePaymentInput {
  bookingId?: string;
  reference?: string;
  amountMinor: number;
  currency?: string;
  channels?: PaystackChannel[];
  productName: string;
  productDescription: string;
  redirectUrl?: string;
  cancelUrl?: string;
  customerName?: string;
  customerMobile?: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitializeRequest {
  email: string;
  amount: number;
  reference: string;
  currency: string;
  callback_url: string;
  channels?: PaystackChannel[];
  metadata?: Record<string, unknown>;
}

export interface PaystackInitializeResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface PaystackVerifyResponse {
  id: number;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  gateway_response?: string;
  paid_at?: string | null;
  channel?: string;
  metadata?: Record<string, unknown> | null;
  customer?: {
    email?: string | null;
  };
}

export interface PaystackWebhookPayload {
  event: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    currency: string;
    gateway_response?: string;
    channel?: string;
    metadata?: Record<string, unknown> | null;
    paid_at?: string | null;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
