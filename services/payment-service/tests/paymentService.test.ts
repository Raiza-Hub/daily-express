import { createHmac } from "node:crypto";
import { PaymentService } from "@/paymentService";
import { emitPaymentCompleted, emitPaymentFailed } from "@/kafka/producer";
import {
  initializePaymentSchema,
  paystackWebhookSchema,
} from "@/validation";

jest.mock("@/kafka/producer");

const mockedEmitPaymentCompleted = emitPaymentCompleted as jest.MockedFunction<
  typeof emitPaymentCompleted
>;
const mockedEmitPaymentFailed = emitPaymentFailed as jest.MockedFunction<
  typeof emitPaymentFailed
>;

const basePayment = {
  id: "payment-1",
  userId: "user-1",
  bookingId: "booking-1",
  provider: "paystack" as const,
  reference: "DX-REFERENCE-1",
  providerTransactionId: null,
  amountMinor: 1430000,
  currency: "NGN",
  productName: "Lagos to Abuja",
  productDescription: "Trip booking",
  customerName: "Test User",
  customerEmail: "test@example.com",
  customerMobile: "08000000000",
  status: "pending" as const,
  providerStatus: "pending",
  checkoutUrl: "https://checkout.paystack.com/test",
  checkoutToken: "ACCESS_CODE",
  redirectUrl: "http://localhost:3000/payment/return?reference=DX-REFERENCE-1",
  cancelUrl: "http://localhost:3000/payment/cancelled?reference=DX-REFERENCE-1",
  channels: ["bank_transfer", "card"],
  rawInitializeResponse: null,
  rawVerificationResponse: null,
  metadata: { bookingId: "booking-1" },
  lastStatusCheckAt: null,
  paidAt: null,
  failedAt: null,
  failureCode: null,
  failureReason: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

function mockInsertReturning(returnValue: unknown) {
  const values = jest.fn().mockReturnThis();
  const returning = jest.fn().mockResolvedValue([returnValue]);
  global.mockDrizzle.insert.mockReturnValueOnce({
    values,
    returning,
  });
  return { values, returning };
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

describe("PaymentService", () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService();
  });

  it("initializes a paystack payment and deduplicates channels", async () => {
    global.mockDrizzle.query.payment.findFirst.mockResolvedValue(null);
    global.mockPaystackHttp.post.mockResolvedValue({
      data: {
        status: true,
        message: "Authorization URL created",
        data: {
          authorization_url: "https://checkout.paystack.com/test",
          access_code: "ACCESS_CODE",
          reference: "DX-REFERENCE-1",
        },
      },
    });

    const insertedPayment = {
      ...basePayment,
      channels: ["bank_transfer", "card", "ussd"],
    };
    const insertCall = mockInsertReturning(insertedPayment);

    const result = await paymentService.initializePayment(
      "user-1",
      "test@example.com",
      {
        bookingId: "booking-1",
        reference: "DX-REFERENCE-1",
        amountMinor: 1430000,
        currency: "NGN",
        channels: ["bank_transfer", "card", "bank_transfer", "ussd"],
        productName: "Lagos to Abuja",
        productDescription: "Trip booking",
        redirectUrl:
          "http://localhost:3000/payment/return?reference=DX-REFERENCE-1",
        cancelUrl:
          "http://localhost:3000/payment/cancelled?reference=DX-REFERENCE-1",
        metadata: { routeId: "route-1" },
      },
    );

    expect(result).toEqual(insertedPayment);
    expect(global.mockPaystackHttp.post).toHaveBeenCalledWith(
      "/transaction/initialize",
      expect.objectContaining({
        email: "test@example.com",
        amount: 1430000,
        reference: "DX-REFERENCE-1",
        channels: ["bank_transfer", "card", "ussd"],
        callback_url:
          "http://localhost:3000/payment/return?reference=DX-REFERENCE-1",
      }),
      expect.any(Object),
    );
    expect(insertCall.values).toHaveBeenCalledWith(
      expect.objectContaining({
        amountMinor: 1430000,
        checkoutUrl: "https://checkout.paystack.com/test",
        checkoutToken: "ACCESS_CODE",
        channels: ["bank_transfer", "card", "ussd"],
        redirectUrl:
          "http://localhost:3000/payment/return?reference=DX-REFERENCE-1",
      }),
    );
  });

  it("marks a refreshed payment successful and emits the completion event", async () => {
    global.mockDrizzle.query.payment.findFirst.mockResolvedValue(basePayment);
    global.mockPaystackHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Verification successful",
        data: {
          id: 12345,
          reference: basePayment.reference,
          status: "success",
          amount: basePayment.amountMinor,
          currency: basePayment.currency,
          gateway_response: "Successful",
          paid_at: "2025-01-02T00:00:00Z",
        },
      },
    });

    const updatedPayment = {
      ...basePayment,
      providerTransactionId: "12345",
      status: "successful" as const,
      providerStatus: "success",
      paidAt: new Date("2025-01-02T00:00:00Z"),
      rawVerificationResponse: { status: true },
    };
    mockUpdateReturning(updatedPayment);

    const result = await paymentService.refreshPaymentStatus(
      "user-1",
      basePayment.reference,
    );

    expect(result).toEqual(updatedPayment);
    expect(global.mockPaystackHttp.get).toHaveBeenCalledWith(
      `/transaction/verify/${encodeURIComponent(basePayment.reference)}`,
      expect.any(Object),
    );
    expect(mockedEmitPaymentCompleted).toHaveBeenCalledWith({
      paymentId: updatedPayment.id,
      bookingId: updatedPayment.bookingId,
      paymentReference: updatedPayment.reference,
    });
  });

  it("fails verification on amount mismatch and emits a failure event", async () => {
    global.mockDrizzle.query.payment.findFirst.mockResolvedValue(basePayment);
    global.mockPaystackHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Verification successful",
        data: {
          id: 12345,
          reference: basePayment.reference,
          status: "success",
          amount: 1200000,
          currency: basePayment.currency,
          gateway_response: "Successful",
        },
      },
    });

    const updatedPayment = {
      ...basePayment,
      providerTransactionId: "12345",
      status: "failed" as const,
      providerStatus: "success",
      failureCode: "amount_mismatch",
      failureReason:
        "Verified payment amount does not match the booking total",
      failedAt: new Date("2025-01-03T00:00:00Z"),
      rawVerificationResponse: { status: true },
    };
    mockUpdateReturning(updatedPayment);

    const result = await paymentService.refreshPaymentStatus(
      "user-1",
      basePayment.reference,
    );

    expect(result.status).toBe("failed");
    expect(mockedEmitPaymentFailed).toHaveBeenCalledWith({
      paymentId: updatedPayment.id,
      bookingId: updatedPayment.bookingId,
      paymentReference: updatedPayment.reference,
      paymentStatus: "failed",
      failureReason:
        "Verified payment amount does not match the booking total",
    });
  });

  it("ignores a webhook with an invalid signature", async () => {
    mockInsertReturning({
      id: "webhook-1",
      provider: "paystack",
    });
    global.mockDrizzle.query.payment.findFirst.mockResolvedValue(basePayment);
    const webhookUpdate = mockUpdateWithoutReturning();

    const result = await paymentService.processWebhook({
      signature: "invalid-signature",
      rawBody: Buffer.from(JSON.stringify({ event: "charge.success" })),
      event: {
        event: "charge.success",
        data: {
          id: 12345,
          status: "success",
          reference: basePayment.reference,
          amount: basePayment.amountMinor,
          currency: basePayment.currency,
        },
      },
    });

    expect(result).toEqual({
      acknowledged: true,
      processed: false,
    });
    expect(global.mockPaystackHttp.get).not.toHaveBeenCalled();
    expect(webhookUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationNote: "Webhook signature verification failed",
      }),
    );
  });

  it("processes a valid charge.success webhook by re-verifying the payment", async () => {
    const event = {
      event: "charge.success",
      data: {
        id: 12345,
        status: "success",
        reference: basePayment.reference,
        amount: basePayment.amountMinor,
        currency: basePayment.currency,
      },
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    const signature = createHmac(
      "sha512",
      process.env.PAYSTACK_SECRET_KEY as string,
    )
      .update(rawBody)
      .digest("hex");

    mockInsertReturning({
      id: "webhook-1",
      provider: "paystack",
    });
    global.mockDrizzle.query.payment.findFirst.mockResolvedValue(basePayment);
    global.mockPaystackHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Verification successful",
        data: {
          id: 12345,
          reference: basePayment.reference,
          status: "success",
          amount: basePayment.amountMinor,
          currency: basePayment.currency,
          gateway_response: "Successful",
          paid_at: "2025-01-02T00:00:00Z",
        },
      },
    });
    const updatedPayment = {
      ...basePayment,
      providerTransactionId: "12345",
      status: "successful" as const,
      providerStatus: "success",
      paidAt: new Date("2025-01-02T00:00:00Z"),
    };
    mockUpdateReturning(updatedPayment);
    const webhookUpdate = mockUpdateWithoutReturning();

    const result = await paymentService.processWebhook({
      signature,
      rawBody,
      event,
    });

    expect(result).toEqual({
      acknowledged: true,
      processed: true,
      payment: updatedPayment,
    });
    expect(global.mockPaystackHttp.get).toHaveBeenCalledTimes(1);
    expect(webhookUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        verificationNote:
          "Webhook verified via signature and Paystack verification API",
      }),
    );
  });
});

describe("payment validation", () => {
  it("accepts the full Paystack channel list", () => {
    const { error, value } = initializePaymentSchema.validate({
      amountMinor: 1430000,
      currency: "NGN",
      channels: [
        "bank_transfer",
        "card",
        "bank",
        "ussd",
        "qr",
        "mobile_money",
        "apple_pay",
        "eft",
        "capitec_pay",
        "payattitude",
      ],
      productName: "Lagos to Abuja",
      productDescription: "Trip booking",
      redirectUrl: "http://localhost:3000/payment/return",
    });

    expect(error).toBeUndefined();
    expect(value.channels).toHaveLength(10);
  });

  it("rejects unsupported payment channels", () => {
    const { error } = initializePaymentSchema.validate({
      amountMinor: 1430000,
      currency: "NGN",
      channels: ["crypto"],
      productName: "Lagos to Abuja",
      productDescription: "Trip booking",
      redirectUrl: "http://localhost:3000/payment/return",
    });

    expect(error).toBeDefined();
  });

  it("validates paystack webhook payloads", () => {
    const { error } = paystackWebhookSchema.validate({
      event: "charge.success",
      data: {
        id: 12345,
        status: "success",
        reference: "DX-REFERENCE-1",
        amount: 1430000,
        currency: "NGN",
      },
    });

    expect(error).toBeUndefined();
  });
});
