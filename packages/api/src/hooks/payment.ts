import { useMutation, useQuery } from "@tanstack/react-query";
import { paymentApi } from "../api";
import type {
  ApiResponse,
  InitializePaymentRequest,
  Payment,
} from "@shared/types";
import { handleApiError } from "../utils";

export const initializePaymentFn = async (
  data: InitializePaymentRequest,
): Promise<Payment> => {
  try {
    const response = await paymentApi.post<ApiResponse<Payment>>(
      "/payments/initialize",
      data,
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to initialize payment");
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to initialize payment") as never;
  }
};

export const getPaymentByReferenceFn = async (
  reference: string,
): Promise<Payment> => {
  try {
    const response = await paymentApi.get<ApiResponse<Payment>>(
      `/payments/reference/${reference}`,
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to fetch payment");
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to fetch payment") as never;
  }
};

export const refreshPaymentStatusFn = async (
  reference: string,
): Promise<Payment> => {
  try {
    const response = await paymentApi.post<ApiResponse<Payment>>(
      `/payments/reference/${reference}/refresh`,
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to refresh payment");
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to refresh payment") as never;
  }
};

export const useInitializePayment = (options?: {
  onSuccess?: (data: Payment) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: initializePaymentFn,
    ...options,
  });
};

export const useGetPaymentByReference = (
  reference: string,
  options?: { enabled?: boolean },
) => {
  return useQuery({
    queryKey: ["payment", reference],
    queryFn: () => getPaymentByReferenceFn(reference),
    retry: false,
    enabled: (options?.enabled ?? true) && Boolean(reference),
  });
};

export const useRefreshPaymentStatus = (options?: {
  onSuccess?: (data: Payment) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: refreshPaymentStatusFn,
    ...options,
  });
};
