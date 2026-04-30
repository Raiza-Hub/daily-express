import type { PayoutStatus } from "@shared/types";

export interface KoraApiEnvelope<TData> {
  status: boolean;
  message: string;
  data?: TData;
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

export interface KoraPayoutWebhookPayload {
  event: string;
  data: {
    amount: number;
    fee: number | string;
    currency: string;
    status: string;
    reference: string;
    message?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface PayoutHistoryQuery {
  limit?: number;
  cursor?: string;
  status?: PayoutStatus;
}

export interface ResolvedBankAccount {
  accountName: string;
  bankName: string;
  bankCode: string;
}

export interface PayoutBalanceAccumulator {
  pendingAmountMinor: number;
  availableAmountMinor: number;
  processingAmountMinor: number;
  paidAmountMinor: number;
}

export interface DriverPendingPayoutTripRow {
  tripId: string;
  routeId: string;
  tripDate: Date | string;
  pickupTitle: string;
  dropoffTitle: string;
  pendingAmountMinor: number;
  currency: string;
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
