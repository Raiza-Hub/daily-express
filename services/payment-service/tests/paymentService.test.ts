import { createHmac } from "node:crypto";
import {
  emitPaymentCompleted,
  emitPaymentFailed,
  sendRefundFailedNotification,
} from "@/kafka/producer";
import { paymentService } from "@/paymentService";
import { handlePaymentExpiry } from "@/paymentExpireHandler";
import { processWebhookJob } from "@/webhookProcessor";
import { initializePaymentSchema, koraWebhookSchema } from "@/validation";
import { KORA_CHECKOUT_CHANNELS } from "@shared/types";

jest.mock("@/kafka/producer");

const mockedEmitPaymentCompleted = emitPaymentCompleted as jest.MockedFunction<
  typeof emitPaymentCompleted
>;
const mockedEmitPaymentFailed = emitPaymentFailed as jest.MockedFunction<
  typeof emitPaymentFailed
>;
const mockedSendRefundFailedNotification =
  sendRefundFailedNotification as jest.MockedFunction<
    typeof sendRefundFailedNotification
  >;

const baseProjection = {
  id: "hold-1",
  bookingId: "booking-1",
  tripId: "trip-1",
  userId: "user-1",
  fareAmount: 13000,
  currency: "NGN",
  expiresAt: new Date("2099-04-21T13:00:00.000Z"),
  pgBossJobId: "job-expire-1",
  createdAt: new Date("2099-04-21T12:00:00.000Z"),
  updatedAt: new Date("2099-04-21T12:00:00.000Z"),
};

const basePayment = {
  id: "payment-1",
  userId: "user-1",
  bookingId: "booking-1",
  provider: "kora" as const,
  reference: "DX-REFERENCE-1",
  providerTransactionId: null,
  amount: 14300,
  currency: "NGN",
  productName: "Lagos to Abuja",
  productDescription: "Trip booking",
  customerName: "Test User",
  customerEmail: "test@example.com",
  customerMobile: "08000000000",
  status: "pending" as const,
  providerStatus: "pending",
  checkoutUrl: "https://checkout.korapay.com/pay/DX-REFERENCE-1",
  checkoutToken: "DX-REFERENCE-1",
  redirectUrl:
    "https://daily-express.test/api/payments/v1/payments/return?ref=DX-REFERENCE-1",
  cancelUrl: "http://localhost:3000/trip-status",
  channels: ["bank_transfer", "card"],
  rawInitializeResponse: null,
  rawVerificationResponse: null,
  metadata: { bookingId: "booking-1", routeId: "route-1" },
  lastStatusCheckAt: null,
  paidAt: null,
  failedAt: null,
  failureCode: null,
  failureReason: null,
  createdAt: new Date("2099-04-21T12:00:00.000Z"),
  updatedAt: new Date("2099-04-21T12:00:00.000Z"),
};

function mockInsert(returnValue?: unknown) {
  const values = jest.fn();
  const chain = {
    values,
  } as Record<string, jest.Mock>;

  if (returnValue !== undefined) {
    chain.returning = jest.fn().mockResolvedValue([returnValue]);
    values.mockReturnValue(chain);
  } else {
    values.mockResolvedValue(undefined);
  }

  global.mockDrizzle.insert.mockReturnValueOnce(chain);
  return chain;
}

function mockUpdateReturning(returnValue: unknown) {
  const set = jest.fn().mockReturnThis();
  const where = jest.fn().mockReturnThis();
  const returning = jest.fn().mockResolvedValue([returnValue]);
  global.mockDrizzle.update.mockReturnValueOnce({
    set,
    where,
    returning,
  });
  return { set, where, returning };
}

function mockUpdateWithoutReturning() {
  const set = jest.fn().mockReturnThis();
  const where = jest.fn().mockResolvedValue(undefined);
  global.mockDrizzle.update.mockReturnValueOnce({
    set,
    where,
  });
  return { set, where };
}

function mockDelete() {
  const where = jest.fn().mockResolvedValue(undefined);
  global.mockDrizzle.delete.mockReturnValueOnce({
    where,
  });
  return { where };
}

describe("payment-service strict plan", () => {
  it("initializes a payment, persists the checkout, and schedules the expiry job", async () => {
    global.mockDrizzle.query.bookingHold.findFirst
      .mockResolvedValueOnce(baseProjection)
      .mockResolvedValueOnce(baseProjection);
    global.mockDrizzle.query.payment.findFirst.mockResolvedValueOnce(null);
    global.mockKoraHttp.post.mockResolvedValue({
      data: {
        status: true,
        message: "Charge created successfully",
        data: {
          reference: "DX-REFERENCE-1",
          checkout_url: basePayment.checkoutUrl,
        },
      },
    });

    mockInsert(basePayment);
    mockUpdateWithoutReturning();
    global.mockBoss.send.mockResolvedValueOnce("job-expire-1");

    const result = await paymentService.initializePayment(
      "user-1",
      "test@example.com",
      {
        bookingId: "booking-1",
        reference: "DX-REFERENCE-1",
        currency: "NGN",
        channels: ["bank_transfer", "card", "bank_transfer"],
        productName: "Lagos to Abuja",
        productDescription: "Trip booking",
        metadata: {
          routeId: "route-1",
          tripDate: "2026-04-21",
        },
      },
    );

    expect(global.mockKoraHttp.post).toHaveBeenCalledWith(
      "/merchant/api/v1/charges/initialize",
      expect.objectContaining({
        amount: 14300,
        channels: ["bank_transfer", "card"],
        currency: "NGN",
        notification_url:
          "https://daily-express.test/api/payments/v1/payments/webhooks/kora",
        redirect_url:
          "https://daily-express.test/api/payments/v1/payments/return?ref=DX-REFERENCE-1",
      }),
      expect.any(Object),
    );
    expect(global.mockBoss.send).toHaveBeenCalledWith(
      "payment.expire",
      {
        bookingId: "booking-1",
        reference: "DX-REFERENCE-1",
      },
      expect.objectContaining({
        singletonKey: "expire-booking-1",
        startAfter: baseProjection.expiresAt,
      }),
    );
    expect(result).toEqual({
      ...basePayment,
      expiresAt: baseProjection.expiresAt,
    });
  });

  it("reuses an existing pending checkout when Kora still reports it pending", async () => {
    global.mockDrizzle.query.bookingHold.findFirst.mockResolvedValueOnce(
      baseProjection,
    );
    global.mockDrizzle.query.payment.findFirst.mockResolvedValueOnce(
      basePayment,
    );
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Charge retrieved successfully",
        data: {
          reference: basePayment.reference,
          status: "pending",
          amount: "14300.00",
          amount_paid: "0.00",
          currency: "NGN",
        },
      },
    });

    const result = await paymentService.initializePayment(
      "user-1",
      "test@example.com",
      {
        bookingId: "booking-1",
        currency: "NGN",
        channels: ["bank_transfer"],
        productName: "Lagos to Abuja",
        productDescription: "Trip booking",
      },
    );

    expect(global.mockKoraHttp.get).toHaveBeenCalledWith(
      "/merchant/api/v1/charges/DX-REFERENCE-1",
      expect.any(Object),
    );
    expect(global.mockKoraHttp.post).not.toHaveBeenCalled();
    expect(global.mockDrizzle.update).not.toHaveBeenCalled();
    expect(result).toEqual({
      ...basePayment,
      expiresAt: baseProjection.expiresAt,
    });
  });

  it("confirms an existing pending checkout when Kora reports success during retry", async () => {
    const successfulPayment = {
      ...basePayment,
      providerTransactionId: "KPY-PAY-retry-success",
      status: "successful" as const,
      providerStatus: "success",
      paidAt: new Date("2099-04-21T12:35:00.000Z"),
      rawVerificationResponse: { status: true },
    };

    global.mockDrizzle.query.bookingHold.findFirst
      .mockResolvedValueOnce(baseProjection)
      .mockResolvedValueOnce(baseProjection);
    global.mockDrizzle.query.payment.findFirst
      .mockResolvedValueOnce(basePayment)
      .mockResolvedValueOnce(basePayment);
    global.mockDrizzle.query.outboxEvents.findFirst.mockResolvedValueOnce(null);
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Charge retrieved successfully",
        data: {
          reference: basePayment.reference,
          payment_reference: "KPY-PAY-retry-success",
          status: "success",
          amount: "14300.00",
          amount_paid: "14300.00",
          currency: "NGN",
          paid_at: "2099-04-21T12:35:00.000Z",
        },
      },
    });

    mockUpdateReturning(successfulPayment);
    mockUpdateWithoutReturning();

    const result = await paymentService.initializePayment(
      "user-1",
      "test@example.com",
      {
        bookingId: "booking-1",
        currency: "NGN",
        channels: ["bank_transfer"],
        productName: "Lagos to Abuja",
        productDescription: "Trip booking",
      },
    );

    expect(mockedEmitPaymentCompleted).toHaveBeenCalledWith({
      bookingId: successfulPayment.bookingId,
      paidAt: "2099-04-21T12:35:00.000Z",
      paymentId: successfulPayment.id,
      paymentReference: successfulPayment.reference,
      userEmail: successfulPayment.customerEmail,
    });
    expect(global.mockKoraHttp.post).not.toHaveBeenCalled();
    expect(result.status).toBe("successful");
  });

  it("refreshes an existing pending checkout when Kora reports it abandoned", async () => {
    const refreshedPayment = {
      ...basePayment,
      reference: "DX-REFERENCE-2",
      checkoutUrl: "https://checkout.korapay.com/pay/DX-REFERENCE-2",
      checkoutToken: "DX-REFERENCE-2",
      redirectUrl:
        "https://daily-express.test/api/payments/v1/payments/return?ref=DX-REFERENCE-2",
      channels: ["bank_transfer"],
      rawInitializeResponse: { status: true },
      updatedAt: new Date("2099-04-21T12:40:00.000Z"),
    };

    global.mockDrizzle.query.bookingHold.findFirst.mockResolvedValueOnce(
      baseProjection,
    );
    global.mockDrizzle.query.payment.findFirst.mockResolvedValueOnce(
      basePayment,
    );
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Charge retrieved successfully",
        data: {
          reference: basePayment.reference,
          status: "abandoned",
          amount: "14300.00",
          amount_paid: "0.00",
          currency: "NGN",
        },
      },
    });
    global.mockKoraHttp.post.mockResolvedValue({
      data: {
        status: true,
        message: "Charge created successfully",
        data: {
          reference: refreshedPayment.reference,
          checkout_url: refreshedPayment.checkoutUrl,
        },
      },
    });
    global.mockBoss.send.mockResolvedValueOnce("job-expire-2");

    const refreshUpdate = mockUpdateReturning(refreshedPayment);
    mockUpdateWithoutReturning();
    mockUpdateWithoutReturning();

    const result = await paymentService.initializePayment(
      "user-1",
      "test@example.com",
      {
        bookingId: "booking-1",
        currency: "NGN",
        channels: ["bank_transfer"],
        productName: "Lagos to Abuja",
        productDescription: "Trip booking",
        metadata: {
          routeId: "route-1",
        },
      },
    );

    const refreshPayload = refreshUpdate.set.mock.calls[0][0];
    expect(global.mockBoss.cancel).toHaveBeenCalledWith(
      "payment.expire",
      "job-expire-1",
    );
    expect(global.mockKoraHttp.post).toHaveBeenCalledWith(
      "/merchant/api/v1/charges/initialize",
      expect.objectContaining({
        reference: refreshPayload.reference,
        redirect_url: expect.stringContaining(
          encodeURIComponent(refreshPayload.reference),
        ),
      }),
      expect.any(Object),
    );
    expect(refreshPayload).toEqual(
      expect.objectContaining({
        status: "pending",
        providerStatus: "pending",
        checkoutUrl: refreshedPayment.checkoutUrl,
        checkoutToken: refreshedPayment.checkoutToken,
        failureCode: null,
        failureReason: null,
        failedAt: null,
        rawVerificationResponse: null,
      }),
    );
    expect(refreshPayload.reference).not.toBe(basePayment.reference);
    expect(global.mockBoss.send).toHaveBeenCalledWith(
      "payment.expire",
      {
        bookingId: "booking-1",
        reference: refreshPayload.reference,
      },
      expect.objectContaining({
        singletonKey: "expire-booking-1",
        startAfter: baseProjection.expiresAt,
      }),
    );
    expect(mockedEmitPaymentFailed).not.toHaveBeenCalled();
    expect(result).toEqual({
      ...refreshedPayment,
      expiresAt: baseProjection.expiresAt,
    });
  });

  it("rejects payment initialization for a booking owned by another user", async () => {
    global.mockDrizzle.query.bookingHold.findFirst.mockResolvedValueOnce({
      ...baseProjection,
      userId: "user-2",
    });

    await expect(
      paymentService.initializePayment("user-1", "test@example.com", {
        bookingId: "booking-1",
        productName: "Lagos to Abuja",
        productDescription: "Trip booking",
      }),
    ).rejects.toMatchObject({
      statusCode: 404,
      message: "Booking not found",
    });
  });

  it("resolves a successful checkout return, confirms the payment, and emits payment.completed", async () => {
    const successfulPayment = {
      ...basePayment,
      providerTransactionId: "KPY-PAY-rYF4c5ZWioeb",
      status: "successful" as const,
      providerStatus: "success",
      paidAt: new Date("2099-04-21T12:30:00.000Z"),
      rawVerificationResponse: { status: true },
    };

    global.mockDrizzle.query.payment.findFirst
      .mockResolvedValueOnce(basePayment)
      .mockResolvedValueOnce(basePayment);
    global.mockDrizzle.query.bookingHold.findFirst
      .mockResolvedValueOnce(baseProjection)
      .mockResolvedValueOnce(baseProjection);
    global.mockDrizzle.query.outboxEvents.findFirst.mockResolvedValueOnce(null);
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Charge retrieved successfully",
        data: {
          reference: basePayment.reference,
          payment_reference: "KPY-PAY-rYF4c5ZWioeb",
          status: "success",
          amount: "14300.00",
          amount_paid: "14300.00",
          currency: "NGN",
          paid_at: "2099-04-21T12:30:00.000Z",
        },
      },
    });

    mockUpdateReturning(successfulPayment);
    mockUpdateWithoutReturning();

    const result = await paymentService.resolveReturnUrl(
      basePayment.reference,
      "cancelled",
    );

    expect(global.mockBoss.cancel).toHaveBeenCalledWith(
      "payment.expire",
      "job-expire-1",
    );
    expect(mockedEmitPaymentCompleted).toHaveBeenCalledWith({
      bookingId: successfulPayment.bookingId,
      paidAt: "2099-04-21T12:30:00.000Z",
      paymentId: successfulPayment.id,
      paymentReference: successfulPayment.reference,
      userEmail: successfulPayment.customerEmail,
    });
    expect(result).toBe("http://localhost:3000/trip-status");
  });

  it("verifies a signed webhook, stores the audit record, and queues async processing", async () => {
    const webhook = {
      event: "charge.success",
      data: {
        status: "success",
        reference: basePayment.reference,
        amount: basePayment.amount,
        currency: basePayment.currency,
      },
    };
    const signature = createHmac(
      "sha256",
      process.env.KORA_SECRET_KEY as string,
    )
      .update(JSON.stringify(webhook.data))
      .digest("hex");

    mockInsert();
    global.mockBoss.send.mockResolvedValueOnce("job-webhook-1");

    await paymentService.handleKoraWebhook(webhook, signature);

    expect(global.mockBoss.send).toHaveBeenCalledWith("process.webhook", {
      event: "charge.success",
      data: webhook.data,
      _retryCount: 0,
    });
  });

  it("requeues a success webhook when the booking hold has not arrived yet", async () => {
    global.mockDrizzle.query.outboxEvents.findFirst.mockResolvedValueOnce(null);
    global.mockDrizzle.query.payment.findFirst.mockResolvedValueOnce(
      basePayment,
    );
    global.mockDrizzle.query.bookingHold.findFirst.mockResolvedValueOnce(null);
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Charge retrieved successfully",
        data: {
          reference: basePayment.reference,
          payment_reference: "KPY-PAY-rYF4c5ZWioeb",
          status: "success",
          amount: "14300.00",
          amount_paid: "14300.00",
          currency: "NGN",
        },
      },
    });
    global.mockBoss.send.mockResolvedValueOnce("job-webhook-retry");

    await processWebhookJob({
      event: "charge.success",
      data: {
        status: "success",
        reference: basePayment.reference,
        amount: basePayment.amount,
        currency: basePayment.currency,
      },
      _retryCount: 0,
    });

    expect(global.mockBoss.send).toHaveBeenCalledWith(
      "process.webhook",
      expect.objectContaining({
        _retryCount: 1,
        event: "charge.success",
      }),
      {
        startAfter: 15,
      },
    );
  });

  it("expires a pending payment at hold timeout when Kora still reports it pending", async () => {
    const expiredPayment = {
      ...basePayment,
      status: "expired" as const,
      failureCode: "PAYMENT_EXPIRED",
      failureReason: "Seat reservation expired before payment was completed",
      failedAt: new Date("2099-04-21T13:00:00.000Z"),
    };

    global.mockDrizzle.query.payment.findFirst
      .mockResolvedValueOnce(basePayment)
      .mockResolvedValueOnce(basePayment);
    global.mockDrizzle.query.bookingHold.findFirst
      .mockResolvedValueOnce(baseProjection)
      .mockResolvedValueOnce(null);
    global.mockDrizzle.query.outboxEvents.findFirst.mockResolvedValueOnce(null);
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Charge retrieved successfully",
        data: {
          reference: basePayment.reference,
          status: "pending",
          amount: "14300.00",
          amount_paid: "14300.00",
          currency: "NGN",
        },
      },
    });

    mockUpdateReturning(expiredPayment);
    mockUpdateWithoutReturning();
    mockDelete();

    await handlePaymentExpiry({
      bookingId: basePayment.bookingId,
      reference: basePayment.reference,
    });

    expect(mockedEmitPaymentFailed).toHaveBeenCalledWith({
      bookingId: expiredPayment.bookingId,
      failureReason: "Seat reservation expired before payment was completed",
      paymentId: expiredPayment.id,
      paymentReference: expiredPayment.reference,
      paymentStatus: "expired",
    });
  });

  it("emails the customer when an automatic refund fails", async () => {
    const refundPendingPayment = {
      ...basePayment,
      status: "refund_pending" as const,
      providerStatus: "success",
      failureCode: "AUTO_REFUND_INITIATED",
      failureReason: "Seat reservation expired before payment was completed",
      paidAt: new Date("2099-04-21T12:59:00.000Z"),
    };

    global.mockDrizzle.query.payment.findFirst.mockResolvedValueOnce(
      basePayment,
    );
    global.mockDrizzle.query.bookingHold.findFirst.mockResolvedValueOnce(
      baseProjection,
    );
    global.mockDrizzle.query.outboxEvents.findFirst.mockResolvedValueOnce(null);
    global.mockKoraHttp.post.mockRejectedValueOnce(
      new Error("Insufficient funds in disbursement wallet"),
    );

    mockUpdateReturning(refundPendingPayment);
    mockUpdateWithoutReturning();
    mockDelete();
    mockUpdateWithoutReturning();

    await expect(
      paymentService.initiateAutoRefund(
        basePayment.reference,
        {
          reference: basePayment.reference,
          payment_reference: "KPY-PAY-rYF4c5ZWioeb",
          status: "success",
          amount: "14300.00",
          currency: "NGN",
          paid_at: "2099-04-21T12:59:00.000Z",
        },
        { status: true },
      ),
    ).rejects.toThrow("Insufficient funds in disbursement wallet");

    expect(mockedSendRefundFailedNotification).toHaveBeenCalledWith({
      to: "test@example.com",
      subject: "Refund could not be completed yet",
      template: "RefundFailedEmail",
      propsJson: expect.any(String),
    });
  });
});

describe("payment validation", () => {
  it("accepts the documented Kora checkout redirect channels", () => {
    const { error, value } = initializePaymentSchema.validate({
      bookingId: "70f8cf12-b1b9-4ea7-9023-9478aa0a1fed",
      currency: "NGN",
      channels: [...KORA_CHECKOUT_CHANNELS],
      productName: "Lagos to Abuja",
      productDescription: "Trip booking",
      metadata: {
        routeId: "route-1",
      },
    });

    expect(error).toBeUndefined();
    expect(value.channels).toHaveLength(KORA_CHECKOUT_CHANNELS.length);
  });

  it("rejects unsupported payment channels", () => {
    const { error } = initializePaymentSchema.validate({
      bookingId: "70f8cf12-b1b9-4ea7-9023-9478aa0a1fed",
      amount: 14300,
      currency: "NGN",
      channels: ["crypto"],
      productName: "Lagos to Abuja",
      productDescription: "Trip booking",
    });

    expect(error).toBeDefined();
  });

  it("validates Kora webhook payloads that use payment_reference", () => {
    const { error } = koraWebhookSchema.validate({
      event: "refund.success",
      data: {
        status: "success",
        payment_reference: "DX-REFERENCE-1",
        amount: "14300.00",
        currency: "NGN",
      },
    });

    expect(error).toBeUndefined();
  });
});
