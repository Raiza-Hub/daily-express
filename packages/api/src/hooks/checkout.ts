import { useMutation } from "@tanstack/react-query";
import { paymentApi, routeApi } from "../api";
import type {
  ApiResponse,
  CreateTripCheckoutRequest,
  TripCheckout,
} from "@shared/types";
import { handleApiError } from "../utils";

interface CheckoutBookingResponse {
  booking: {
    id: string;
    expiresAt?: Date | string | null;
  };
  fareAmount: number;
  currency: string;
  expiresAt?: Date | string | null;
}

interface InitializePaymentResponse {
  reference: string;
  checkoutUrl?: string | null;
  expiresAt?: Date | string | null;
}

export const createTripCheckoutFn = async (
  data: CreateTripCheckoutRequest,
): Promise<TripCheckout> => {
  try {
    const bookingResponse = await routeApi.post<
      ApiResponse<CheckoutBookingResponse>
    >("/user/booking/checkout", {
      routeId: data.routeId,
      tripDate: data.tripDate,
    });

    if (!bookingResponse.data.success || !bookingResponse.data.data) {
      throw new Error(
        bookingResponse.data.error || "Failed to create trip checkout",
      );
    }

    const checkoutBooking = bookingResponse.data.data;
    const paymentResponse = await paymentApi.post<
      ApiResponse<InitializePaymentResponse>
    >(
      "/initialize",
      {
        bookingId: checkoutBooking.booking.id,
        channels: data.channels,
        productName: data.productName,
        productDescription: data.productDescription,
        customerName: data.customerName,
        customerMobile: data.customerMobile,
        metadata: data.metadata,
      },
    );

    if (!paymentResponse.data.success || !paymentResponse.data.data) {
      throw new Error(
        paymentResponse.data.error || "Failed to create trip checkout",
      );
    }

    const payment = paymentResponse.data.data;
    return {
      bookingId: checkoutBooking.booking.id,
      paymentReference: payment.reference,
      checkoutUrl: payment.checkoutUrl,
      expiresAt:
        payment.expiresAt ??
        checkoutBooking.expiresAt ??
        checkoutBooking.booking.expiresAt,
    };
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
