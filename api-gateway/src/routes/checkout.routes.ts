import {
  Router,
  type Request,
  type Response,
  type Router as ExpressRouter,
} from "express";
import { getConfig } from "../config/index.js";

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  errors?: Record<string, string[]>;
}

interface Booking {
  id: string;
  tripId: string;
  userId: string;
  expiresAt?: string | Date | null;
}

interface CheckoutBookingResponse {
  booking: Booking;
  fareAmount: number;
  currency: string;
  expiresAt?: string | Date | null;
}

interface PaymentResponse {
  reference: string;
  checkoutUrl?: string | null;
  expiresAt?: string | Date | null;
}

function serviceUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, "")}${path}`;
}

function getForwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const headerNames = [
    "x-user-id",
    "x-user-email",
    "x-user-email-verified",
    "x-user-role",
    "x-request-id",
    "x-correlation-id",
    "sentry-trace",
    "baggage",
  ];

  for (const name of headerNames) {
    const value = req.headers[name];
    if (typeof value === "string") {
      headers[name] = value;
    }
  }

  return headers;
}

async function readServiceResponse<T>(response: globalThis.Response) {
  const body = (await response.json().catch(() => null)) as ApiResponse<T> | null;
  if (response.ok && body?.success && body.data !== undefined) {
    return body.data;
  }

  const error = new Error(
    body?.error || body?.message || `Service request failed: ${response.status}`,
  ) as Error & { statusCode?: number; errors?: Record<string, string[]> };
  error.statusCode = response.status;
  error.errors = body?.errors;
  throw error;
}

function sendError(res: Response, error: unknown) {
  const serviceError = error as Error & {
    statusCode?: number;
    errors?: Record<string, string[]>;
  };
  const statusCode =
    serviceError.statusCode && serviceError.statusCode >= 400
      ? serviceError.statusCode
      : 500;

  return res.status(statusCode).json({
    success: false,
    error: serviceError.message || "Failed to create trip checkout",
    ...(serviceError.errors ? { errors: serviceError.errors } : {}),
  });
}

const router: ExpressRouter = Router();

router.post("/v1/trip", async (req: Request, res: Response) => {
  const config = getConfig();
  let booking: Booking | null = null;

  try {
    const checkoutBookingResponse = await fetch(
      serviceUrl(config.ROUTE_SERVICE_URL, "/v1/route/user/booking/checkout"),
      {
        method: "POST",
        headers: getForwardHeaders(req),
        body: JSON.stringify({
          routeId: req.body?.routeId,
          tripDate: req.body?.tripDate,
        }),
      },
    );
    const checkoutBooking = await readServiceResponse<CheckoutBookingResponse>(
      checkoutBookingResponse,
    );
    booking = checkoutBooking.booking;

    await readServiceResponse<null>(
      await fetch(
        serviceUrl(config.PAYMENT_SERVICE_URL, "/v1/payments/internal/booking-holds"),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service-token": config.INTERNAL_SERVICE_TOKEN,
          },
          body: JSON.stringify({
            bookingId: booking.id,
            tripId: booking.tripId,
            userId: booking.userId,
            fareAmount: checkoutBooking.fareAmount,
            currency: checkoutBooking.currency,
            expiresAt: checkoutBooking.expiresAt ?? booking.expiresAt,
          }),
        },
      ),
    );

    const paymentResponse = await fetch(
      serviceUrl(config.PAYMENT_SERVICE_URL, "/v1/payments/internal/initialize"),
      {
        method: "POST",
        headers: {
          ...getForwardHeaders(req),
          "x-internal-service-token": config.INTERNAL_SERVICE_TOKEN,
        },
        body: JSON.stringify({
          bookingId: booking.id,
          currency: checkoutBooking.currency,
          channels: req.body?.channels,
          productName: req.body?.productName,
          productDescription: req.body?.productDescription,
          customerName: req.body?.customerName,
          customerMobile: req.body?.customerMobile,
          metadata: {
            ...(typeof req.body?.metadata === "object" &&
            req.body.metadata &&
            !Array.isArray(req.body.metadata)
              ? req.body.metadata
              : {}),
            bookingId: booking.id,
            tripId: booking.tripId,
          },
        }),
      },
    );
    const payment = await readServiceResponse<PaymentResponse>(paymentResponse);

    return res.status(201).json({
      success: true,
      data: {
        bookingId: booking.id,
        paymentReference: payment.reference,
        checkoutUrl: payment.checkoutUrl,
        expiresAt: payment.expiresAt ?? checkoutBooking.expiresAt ?? booking.expiresAt,
      },
      message: "Trip checkout created successfully",
    });
  } catch (error) {
    if (booking) {
      await fetch(
        serviceUrl(
          config.ROUTE_SERVICE_URL,
          `/v1/route/internal/bookings/${encodeURIComponent(booking.id)}/compensate-checkout`,
        ),
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-internal-service-token": config.INTERNAL_SERVICE_TOKEN,
          },
          body: JSON.stringify({
            paymentReference: `checkout-init-failed-${booking.id}`,
          }),
        },
      ).catch(() => undefined);
    }

    return sendError(res, error);
  }
});

export default router;
