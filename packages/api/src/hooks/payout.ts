import { useInfiniteQuery } from "@tanstack/react-query";
import { payoutApi } from "../api";
import type {
  ApiResponse,
  DriverPayoutHistoryItem,
  PayoutStatus,
} from "@shared/types";
import { handleApiError } from "../utils";

interface PayoutHistoryResponse {
  payouts: DriverPayoutHistoryItem[];
  nextCursor: string | null;
}

export const getDriverPayoutHistoryFn = async (params?: {
  limit?: number;
  cursor?: string;
  status?: PayoutStatus;
}): Promise<PayoutHistoryResponse> => {
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
      ApiResponse<PayoutHistoryResponse>
    >(
      `/history${searchParams.size ? `?${searchParams.toString()}` : ""}`,
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to fetch payout history");
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to fetch payout history") as never;
  }
};

export const useDriverPayoutHistory = (params?: {
  limit?: number;
  status?: PayoutStatus;
  enabled?: boolean;
}) => {
  return useInfiniteQuery({
    queryKey: ["driver-payout-history", params?.limit, params?.status],
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      getDriverPayoutHistoryFn({
        limit: params?.limit,
        cursor: pageParam ?? undefined,
        status: params?.status,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    retry: false,
    enabled: params?.enabled ?? true,
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.payouts.some(
          (payout) =>
            payout.status === "processing" || payout.status === "failed",
        ),
      )
        ? 15000
        : false,
  });
};
