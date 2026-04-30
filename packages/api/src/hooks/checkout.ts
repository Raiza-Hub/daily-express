import { useMutation } from "@tanstack/react-query";
import { checkoutApi } from "../api";
import type {
  ApiResponse,
  CreateTripCheckoutRequest,
  TripCheckout,
} from "@shared/types";
import { handleApiError } from "../utils";

export const createTripCheckoutFn = async (
  data: CreateTripCheckoutRequest,
): Promise<TripCheckout> => {
  try {
    const response = await checkoutApi.post<ApiResponse<TripCheckout>>(
      "/trip",
      data,
    );

    if (!response.data.success || !response.data.data) {
      throw new Error(response.data.error || "Failed to create trip checkout");
    }

    return response.data.data;
  } catch (err) {
    return handleApiError(err, "Failed to create trip checkout") as never;
  }
};

export const useCreateTripCheckout = (options?: {
  onSuccess?: (data: TripCheckout) => void;
  onError?: (error: Error) => void;
}) => {
  return useMutation({
    mutationFn: createTripCheckoutFn,
    ...options,
  });
};
