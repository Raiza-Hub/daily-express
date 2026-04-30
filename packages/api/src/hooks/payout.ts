import { useQuery } from "@tanstack/react-query";
import { payoutApi } from "../api";
import type {
  ApiResponse,
  DriverPayoutBalance,
  DriverPayoutHistoryItem,
  DriverPayoutSummary,
  PayoutStatus,
  ResolveBankAccountRequest,
  ResolveBankAccountResponse,
} from "@shared/types";
import { handleApiError } from "../utils";

export const getDriverPayoutBalanceFn =
  async (): Promise<DriverPayoutBalance> => {
    try {
      const response =
        await payoutApi.get<ApiResponse<DriverPayoutBalance>>(
          "/payouts/balance",
        );

      if (!response.data.success || !response.data.data) {
        throw new Error(
          response.data.error || "Failed to fetch payout balance",
        );
      }

      return response.data.data;
    } catch (err) {
      return handleApiError(err, "Failed to fetch payout balance") as never;
    }
  };

export const getDriverPayoutHistoryFn = async (params?: {
  limit?: number;
  cursor?: string;
  status?: PayoutStatus;
}): Promise<DriverPayoutHistoryItem[]> => {
  try {
    const searchParams = new URLSearchParams();
    if (params?.limit) {
      searchParams.set("limit", String(params.limit));
    }
    if (params?.cursor) {
      searchParams.set("cursor", params.cursor);
    }
    if (params?.status) {
      searchParams.set("status", params.status);
    }

    const response = await payoutApi.get<
      ApiResponse<DriverPayoutHistoryItem[]>
    >(
      `/payouts/history${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to fetch payout history");
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to fetch payout history") as never;
  }
};

export const getDriverPayoutSummaryFn = async (
  week: string,
): Promise<DriverPayoutSummary> => {
  try {
    const response = await payoutApi.get<ApiResponse<DriverPayoutSummary>>(
      `/payouts/summary?week=${encodeURIComponent(week)}`,
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to fetch payout summary");
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to fetch payout summary") as never;
  }
};

export const resolveBankAccountFn = async (
  data: ResolveBankAccountRequest,
): Promise<ResolveBankAccountResponse> => {
  try {
    const response = await payoutApi.post<
      ApiResponse<ResolveBankAccountResponse>
    >("/payouts/bank-accounts/resolve", data);

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to resolve bank account");
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to resolve bank account") as never;
  }
};

export const useDriverPayoutBalance = (options?: { enabled?: boolean }) => {
  return useQuery({
    queryKey: ["driver-payout-balance"],
    queryFn: getDriverPayoutBalanceFn,
    retry: false,
    enabled: options?.enabled ?? true,
    refetchInterval: (query) =>
      query.state.data?.processingAmountMinor ? 15000 : false,
  });
};

export const useDriverPayoutHistory = (params?: {
  limit?: number;
  cursor?: string;
  status?: PayoutStatus;
  enabled?: boolean;
}) => {
  return useQuery({
    queryKey: [
      "driver-payout-history",
      params?.limit,
      params?.cursor,
      params?.status,
    ],
    queryFn: () =>
      getDriverPayoutHistoryFn({
        limit: params?.limit,
        cursor: params?.cursor,
        status: params?.status,
      }),
    retry: false,
    enabled: params?.enabled ?? true,
    refetchInterval: (query) =>
      query.state.data?.some(
        (payout) =>
          payout.status === "processing" || payout.status === "failed",
      )
        ? 15000
        : false,
  });
};

export const useDriverPayoutSummary = (
  week: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["driver-payout-summary", week],
    queryFn: () => getDriverPayoutSummaryFn(week),
    retry: false,
    enabled: (options?.enabled ?? true) && Boolean(week),
  });
};
