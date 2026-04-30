import { createHash, createHmac } from "node:crypto";
import { PayoutService } from "@/payoutService";
import {
  emitDriverBankVerificationFailed,
  emitDriverBankVerified,
  emitPayoutCompleted,
  emitPayoutFailed,
} from "@/kafka/producer";

jest.mock("@/kafka/producer");

const mockedEmitPayoutCompleted = emitPayoutCompleted as jest.MockedFunction<
  typeof emitPayoutCompleted
>;
const mockedEmitPayoutFailed = emitPayoutFailed as jest.MockedFunction<
  typeof emitPayoutFailed
>;
const mockedEmitDriverBankVerified =
  emitDriverBankVerified as jest.MockedFunction<typeof emitDriverBankVerified>;
const mockedEmitDriverBankVerificationFailed =
  emitDriverBankVerificationFailed as jest.MockedFunction<
    typeof emitDriverBankVerificationFailed
  >;

function mockInsertReturning<T>(returnValue: T) {
  const values = jest.fn().mockReturnThis();
  const onConflictDoNothing = jest.fn().mockReturnThis();
  const returning = jest.fn().mockResolvedValue([returnValue]);
  global.mockDrizzle.insert.mockReturnValueOnce({
    values,
    onConflictDoNothing,
    returning,
  });
  return { values, onConflictDoNothing, returning };
}

function mockInsertWithoutReturning() {
  const values = jest.fn().mockResolvedValue(undefined);
  global.mockDrizzle.insert.mockReturnValueOnce({
    values,
  });
  return { values };
}

function mockUpdateReturning<T>(returnValue: T) {
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

function mockUpdateReturningMany<T>(returnValue: T[]) {
  const set = jest.fn().mockReturnThis();
  const where = jest.fn().mockReturnThis();
  const returning = jest.fn().mockResolvedValue(returnValue);
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

function mockTxUpdateWithoutReturning() {
  const set = jest.fn().mockReturnThis();
  const where = jest.fn().mockResolvedValue(undefined);
  global.mockDrizzleTx.update.mockReturnValueOnce({
    set,
    where,
  });
  return { set, where };
}

const gatewayUser = {
  userId: "user-1",
  email: "driver@example.com",
  emailVerified: true,
  role: "driver",
} as const;

const payoutDriverProfile = {
  driverId: "driver-1",
  userId: "user-1",
  email: "driver@example.com",
  firstName: "Jane",
  lastName: "Driver",
  phone: "08000000000",
  currency: "NGN",
  isActive: true,
  bankName: "GTBank",
  bankCode: "058",
  accountNumber: "1234567890",
  accountName: "Jane Driver",
  bankVerificationStatus: "active",
  bankVerificationFailureReason: null,
  sourceUpdatedAt: new Date(),
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

describe("PayoutService", () => {
  let payoutService: PayoutService;

  beforeEach(() => {
    payoutService = new PayoutService();
  });

  it("creates a pending earning on booking confirmation", async () => {
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
    global.mockDrizzle.query.earning.findFirst.mockResolvedValue(null);
    mockInsertWithoutReturning();
    mockInsertWithoutReturning();

    await payoutService.handleBookingConfirmed(
      {
        eventId: "evt-booking-1",
        eventType: "booking.confirmed",
        eventVersion: 1,
        occurredAt: "2025-01-01T00:00:00.000Z",
        source: "route-service",
        payload: {
          bookingId: "booking-1",
          tripId: "trip-1",
          routeId: "route-1",
          driverId: "driver-1",
          userId: "user-1",
          passengerName: "Ada Obi",
          pickupTitle: "Lagos",
          dropoffTitle: "Ibadan",
          seatNumber: 1,
          fareAmountMinor: 20000,
          currency: "NGN",
          paymentReference: "PAY-1",
          tripDate: "2025-01-09T00:00:00.000Z",
          departureTime: "2025-01-09T08:00:00.000Z",
        },
      },
      "booking.confirmed",
    );

    expect(global.mockDrizzle.insert).toHaveBeenCalledTimes(2);
  });

  it("marks trip earnings available and enqueues one payout job per earning", async () => {
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
    mockUpdateReturningMany([{ id: "earning-1" }, { id: "earning-2" }]);
    mockInsertWithoutReturning();

    await payoutService.handleTripCompleted(
      {
        eventId: "evt-trip-1",
        eventType: "trip.completed",
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "route-service",
        payload: {
          tripId: "trip-1",
          driverId: "driver-1",
          pickupTitle: "Lagos",
          dropoffTitle: "Ibadan",
          tripDate: "2025-01-01T00:00:00.000Z",
          completedAt: new Date().toISOString(),
        },
      },
      "trip.completed",
    );

    expect(global.mockBoss.send).toHaveBeenCalledTimes(2);
    expect(global.mockBoss.send).toHaveBeenNthCalledWith(
      1,
      "process-payout",
      { earningId: "earning-1" },
      expect.objectContaining({ singletonKey: "earning-1", retryLimit: 0 }),
    );
    expect(global.mockBoss.send).toHaveBeenNthCalledWith(
      2,
      "process-payout",
      { earningId: "earning-2" },
      expect.objectContaining({ singletonKey: "earning-2", retryLimit: 0 }),
    );
  });

  it("dedupes repeated trip completion events", async () => {
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue({
      id: "consumed-1",
    });

    await payoutService.handleTripCompleted(
      {
        eventId: "evt-trip-duplicate",
        eventType: "trip.completed",
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "route-service",
        payload: {
          tripId: "trip-1",
          driverId: "driver-1",
          pickupTitle: "Lagos",
          dropoffTitle: "Ibadan",
          tripDate: "2025-01-01T00:00:00.000Z",
          completedAt: new Date().toISOString(),
        },
      },
      "trip.completed",
    );

    expect(global.mockDrizzle.update).not.toHaveBeenCalled();
    expect(global.mockBoss.send).not.toHaveBeenCalled();
  });

  it("stores driver payout profile snapshots from Kafka", async () => {
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue(
      null,
    );
    mockInsertWithoutReturning();
    mockInsertWithoutReturning();

    await payoutService.handleDriverPayoutProfileUpserted(
      {
        eventId: "evt-driver-profile-1",
        eventType: "driver.payout_profile.upserted",
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "driver-service",
        payload: {
          ...payoutDriverProfile,
          updatedAt: new Date().toISOString(),
        },
      },
      "driver.payout_profile.upserted",
    );

    expect(global.mockDrizzle.insert).toHaveBeenCalledTimes(2);
  });

  it("tombstones deleted driver payout profiles from Kafka", async () => {
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue({
      ...payoutDriverProfile,
    });
    const deleteProfileUpdate = mockUpdateWithoutReturning();
    mockInsertWithoutReturning();

    await payoutService.handleDriverPayoutProfileDeleted(
      {
        eventId: "evt-driver-profile-delete-1",
        eventType: "driver.payout_profile.deleted",
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "driver-service",
        payload: {
          driverId: "driver-1",
          userId: "user-1",
          deletedAt: new Date().toISOString(),
        },
      },
      "driver.payout_profile.deleted",
    );

    expect(deleteProfileUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        isActive: false,
        deletedAt: expect.any(Date),
      }),
    );
  });

  it("skips payout jobs for earnings that are no longer payable", async () => {
    global.mockDrizzle.query.earning.findFirst.mockResolvedValue({
      id: "earning-1",
      driverId: "driver-1",
      netAmountMinor: 18000,
      currency: "NGN",
      status: "cancelled",
    } as any);

    await payoutService.triggerPayout("earning-1");

    expect(global.mockDrizzle.query.payout.findFirst).not.toHaveBeenCalled();
    expect(
      global.mockDrizzle.query.driverPayoutProfile.findFirst,
    ).not.toHaveBeenCalled();
    expect(global.mockKoraHttp.post).not.toHaveBeenCalled();
  });

  it("initiates a per-earning payout attempt and waits for the webhook to settle it", async () => {
    global.mockDrizzle.query.earning.findFirst.mockResolvedValue({
      id: "earning-1",
      driverId: "driver-1",
      bookingId: "booking-1",
      tripId: "trip-1",
      routeId: "route-1",
      tripDate: new Date("2025-01-01T00:00:00.000Z"),
      pickupTitle: "Lagos",
      dropoffTitle: "Ibadan",
      grossAmountMinor: 20000,
      koraFeeAmount: 2000,
      netAmountMinor: 18000,
      currency: "NGN",
      status: "available",
      sourceEventId: "evt-1",
      payoutId: null,
      availableAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce(null);
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue({
      ...payoutDriverProfile,
    });
    global.mockDrizzle.query.payoutRecipient.findFirst.mockResolvedValue(null);
    global.mockKoraHttp.post
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Account resolved",
          data: {
            account_name: "Jane Driver",
            account_number: "1234567890",
            bank_name: "GTBank",
            bank_code: "058",
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Payout initiated",
          data: {
            amount: "180.00",
            fee: "0.00",
            currency: "NGN",
            status: "processing",
            reference: "DX-KORA-1",
            customer: {
              name: "Jane Driver",
              email: "driver@example.com",
            },
          },
        },
      });
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Balance fetched",
        data: {
          NGN: {
            available_balance: "5000.00",
            pending_balance: "0.00",
          },
        },
      },
    });
    mockInsertReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "driver-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: null,
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    mockInsertReturning({
      id: "recipient-1",
      driverId: "driver-1",
      provider: "kora",
      recipientCode: "1234567890",
      providerRecipientId: "058",
      bankCode: "058",
      bankName: "GTBank",
      accountName: "Jane Driver",
      accountNumberLast4: "7890",
      detailsFingerprint: "fingerprint",
      status: "active",
      rawResponse: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValue(null);
    mockInsertWithoutReturning();
    mockUpdateWithoutReturning();
    const processingEarningUpdate = mockUpdateWithoutReturning();

    await payoutService.triggerPayout("earning-1");

    expect(global.mockKoraHttp.post).toHaveBeenNthCalledWith(
      2,
      "/merchant/api/v1/transactions/disburse",
      expect.objectContaining({
        reference: expect.stringMatching(/^DX-PO-123_attempt_1$/),
        destination: expect.objectContaining({
          amount: 180,
          bank_account: {
            bank: "058",
            account: "1234567890",
          },
        }),
      }),
      expect.any(Object),
    );
    expect(processingEarningUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        payoutId: "payout-1",
      }),
    );
    expect(global.mockBoss.sendAfter).not.toHaveBeenCalled();
  });

  it("schedules a long retry when the Kora balance is insufficient", async () => {
    global.mockDrizzle.query.earning.findFirst.mockResolvedValue({
      id: "earning-1",
      driverId: "driver-1",
      netAmountMinor: 18000,
      currency: "NGN",
      status: "available",
    } as any);
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce(null);
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue({
      ...payoutDriverProfile,
    });
    global.mockDrizzle.query.payoutRecipient.findFirst.mockResolvedValue(null);
    global.mockKoraHttp.post.mockResolvedValueOnce({
      data: {
        status: true,
        message: "Account resolved",
        data: {
          account_name: "Jane Driver",
          account_number: "1234567890",
          bank_name: "GTBank",
          bank_code: "058",
        },
      },
    });
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Balance fetched",
        data: {
          NGN: {
            available_balance: "50.00",
            pending_balance: "0.00",
          },
        },
      },
    });
    mockInsertReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "driver-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: null,
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    mockInsertReturning({
      id: "recipient-1",
      driverId: "driver-1",
      provider: "kora",
      recipientCode: "1234567890",
      providerRecipientId: "058",
      bankCode: "058",
      bankName: "GTBank",
      accountName: "Jane Driver",
      accountNumberLast4: "7890",
      detailsFingerprint: "fingerprint",
      status: "active",
      rawResponse: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    const retryEarningUpdate = mockUpdateWithoutReturning();

    await payoutService.triggerPayout("earning-1");

    expect(global.mockBoss.sendAfter).toHaveBeenCalledWith(
      "process-payout",
      { earningId: "earning-1" },
      expect.objectContaining({ singletonKey: "earning-1", retryLimit: 0 }),
      1800,
    );
    expect(retryEarningUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        payoutId: "payout-1",
      }),
    );
  });

  it("retries retryable Kora initiation errors with backoff", async () => {
    global.mockDrizzle.query.earning.findFirst.mockResolvedValue({
      id: "earning-1",
      driverId: "driver-1",
      netAmountMinor: 18000,
      currency: "NGN",
      status: "available",
    } as any);
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce(null);
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue({
      ...payoutDriverProfile,
    });
    global.mockDrizzle.query.payoutRecipient.findFirst.mockResolvedValue(null);
    global.mockKoraHttp.post
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Account resolved",
          data: {
            account_name: "Jane Driver",
            account_number: "1234567890",
            bank_name: "GTBank",
            bank_code: "058",
          },
        },
      })
      .mockRejectedValueOnce(
        Object.assign(new Error("Processing error"), {
          koraErrorCode: "BANK_PROCESSING_ERROR",
        }),
      );
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Balance fetched",
        data: {
          NGN: {
            available_balance: "5000.00",
            pending_balance: "0.00",
          },
        },
      },
    });
    mockInsertReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "driver-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: null,
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    mockInsertReturning({
      id: "recipient-1",
      driverId: "driver-1",
      provider: "kora",
      recipientCode: "1234567890",
      providerRecipientId: "058",
      bankCode: "058",
      bankName: "GTBank",
      accountName: "Jane Driver",
      accountNumberLast4: "7890",
      detailsFingerprint: "fingerprint",
      status: "active",
      rawResponse: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValue(null);
    mockInsertWithoutReturning();
    mockUpdateWithoutReturning();
    const retryUpdate = mockUpdateWithoutReturning();
    const retryEarningUpdate = mockUpdateWithoutReturning();

    await payoutService.triggerPayout("earning-1");

    expect(global.mockBoss.sendAfter).toHaveBeenCalledWith(
      "process-payout",
      { earningId: "earning-1" },
      expect.objectContaining({ singletonKey: "earning-1", retryLimit: 0 }),
      60,
    );
    expect(retryUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        retryCount: 1,
        failureCode: "API_ERROR",
        failureReason: "API_ERROR",
      }),
    );
    expect(retryEarningUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        payoutId: "payout-1",
      }),
    );
  });

  it("verifies an ambiguous initiation error before retrying and settles if Kora already processed it", async () => {
    global.mockDrizzle.query.earning.findFirst.mockResolvedValue({
      id: "earning-1",
      driverId: "driver-1",
      netAmountMinor: 18000,
      currency: "NGN",
      status: "available",
    } as any);
    global.mockDrizzle.query.payout.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "payout-1",
        driverId: "driver-1",
        recipientId: "recipient-1",
        earningId: "earning-1",
        reference: "DX-PO-123",
        provider: "kora",
        amountMinor: 18000,
        koraFeeAmount: null,
        currency: "NGN",
        earningsCount: 1,
        status: "processing",
        driverEmail: "driver@example.com",
        failureCode: null,
        failureReason: null,
        retryCount: 0,
        nextRetryAt: null,
        initiatedAt: null,
        settledAt: null,
        failedAt: null,
        rawInitiateResponse: null,
        rawFinalStatusResponse: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue({
      ...payoutDriverProfile,
    });
    global.mockDrizzle.query.payoutRecipient.findFirst.mockResolvedValue(null);
    global.mockDrizzle.query.payoutAttempt.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "attempt-1",
        payoutId: "payout-1",
        attemptNumber: 1,
        koraReference: "DX-PO-123_attempt_1",
        status: "pending_verification",
        failureReason: "Kora request failed",
        initiatedAt: new Date(),
        settledAt: null,
        rawWebhook: null,
      });
    global.mockAxios.isAxiosError.mockReturnValue(true as any);
    global.mockKoraHttp.post
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Account resolved",
          data: {
            account_name: "Jane Driver",
            account_number: "1234567890",
            bank_name: "GTBank",
            bank_code: "058",
          },
        },
      })
      .mockRejectedValueOnce({
        message: "Service unavailable",
        response: {
          status: 503,
          data: {
            message: "Service unavailable",
          },
        },
      });
    global.mockKoraHttp.get
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Balance fetched",
          data: {
            NGN: {
              available_balance: "5000.00",
              pending_balance: "0.00",
            },
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Payout history fetched",
          data: [
            {
              reference: "DX-PO-123_attempt_1",
              status: "success",
              amount: "180.00",
              fee: "2.50",
              currency: "NGN",
              message: "Payout successful",
            },
          ],
        },
      });
    mockInsertReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "driver-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: null,
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    mockInsertReturning({
      id: "recipient-1",
      driverId: "driver-1",
      provider: "kora",
      recipientCode: "1234567890",
      providerRecipientId: "058",
      bankCode: "058",
      bankName: "GTBank",
      accountName: "Jane Driver",
      accountNumberLast4: "7890",
      detailsFingerprint: "fingerprint",
      status: "active",
      rawResponse: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockInsertWithoutReturning();
    mockUpdateWithoutReturning();
    mockTxUpdateWithoutReturning();
    mockTxUpdateWithoutReturning();
    mockTxUpdateWithoutReturning();

    await payoutService.triggerPayout("earning-1");

    expect(global.mockKoraHttp.get).toHaveBeenNthCalledWith(
      2,
      "/merchant/api/v1/payouts",
      expect.objectContaining({
        headers: expect.any(Object),
        params: expect.objectContaining({ limit: 100 }),
      }),
    );
    expect(mockedEmitPayoutCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutId: "payout-1",
        driverId: "driver-1",
        reference: "DX-PO-123",
        amountMinor: 18000,
        currency: "NGN",
      }),
    );
    expect(global.mockBoss.sendAfter).not.toHaveBeenCalled();
  });

  it("marks fatal initiation errors as permanent failures and emits the failure event through the worker hook", async () => {
    global.mockDrizzle.query.earning.findFirst.mockResolvedValue({
      id: "earning-1",
      driverId: "driver-1",
      netAmountMinor: 18000,
      currency: "NGN",
      status: "available",
    } as any);
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce(null);
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue({
      ...payoutDriverProfile,
    });
    global.mockDrizzle.query.payoutRecipient.findFirst.mockResolvedValue(null);
    global.mockKoraHttp.post
      .mockResolvedValueOnce({
        data: {
          status: true,
          message: "Account resolved",
          data: {
            account_name: "Jane Driver",
            account_number: "1234567890",
            bank_name: "GTBank",
            bank_code: "058",
          },
        },
      })
      .mockRejectedValueOnce(
        Object.assign(new Error("Invalid account"), {
          koraErrorCode: "INVALID_ACCOUNT",
        }),
      );
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Balance fetched",
        data: {
          NGN: {
            available_balance: "5000.00",
            pending_balance: "0.00",
          },
        },
      },
    });
    mockInsertReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "driver-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: null,
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    mockInsertReturning({
      id: "recipient-1",
      driverId: "driver-1",
      provider: "kora",
      recipientCode: "1234567890",
      providerRecipientId: "058",
      bankCode: "058",
      bankName: "GTBank",
      accountName: "Jane Driver",
      accountNumberLast4: "7890",
      detailsFingerprint: "fingerprint",
      status: "active",
      rawResponse: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValue(null);
    mockInsertWithoutReturning();
    mockUpdateWithoutReturning();
    mockUpdateReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "permanent_failed",
      driverEmail: "driver@example.com",
      failureCode: "permanent_failed",
      failureReason: "INVALID_ACCOUNT",
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: new Date(),
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const manualReviewUpdate = mockUpdateWithoutReturning();

    await expect(payoutService.triggerPayout("earning-1")).rejects.toThrow(
      "PERMANENT_FAILURE:INVALID_ACCOUNT",
    );

    expect(manualReviewUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "manual_review",
        payoutId: "payout-1",
      }),
    );

    global.mockDrizzle.query.payout.findFirst.mockReset();
    global.mockDrizzle.query.payout.findFirst.mockResolvedValue({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "permanent_failed",
      driverEmail: "driver@example.com",
      failureCode: "permanent_failed",
      failureReason: "INVALID_ACCOUNT",
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: null,
      settledAt: null,
      failedAt: new Date(),
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockDrizzle.query.payoutRecipient.findFirst.mockResolvedValue({
      id: "recipient-1",
      driverId: "driver-1",
      bankName: "GTBank",
      accountName: "Jane Driver",
      accountNumberLast4: "7890",
    } as any);

    await payoutService.emitFailureForPermanentPayout("earning-1");

    expect(mockedEmitPayoutFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        payoutId: "payout-1",
        driverId: "driver-1",
        driverEmail: "driver@example.com",
        failureReason: "INVALID_ACCOUNT",
        bankName: "GTBank",
        accountLast4: "7890",
      }),
    );
  });

  it("skips a new payout initiation when a previous attempt already settled", async () => {
    const recipientFingerprint = createHash("sha256")
      .update(["058", "GTBank", "1234567890", "Jane Driver", "NGN"].join("|"))
      .digest("hex");

    global.mockDrizzle.query.earning.findFirst.mockResolvedValue({
      id: "earning-1",
      driverId: "driver-1",
      netAmountMinor: 18000,
      currency: "NGN",
      status: "available",
    } as any);
    global.mockDrizzle.query.payout.findFirst.mockResolvedValue({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "failed",
      driverEmail: "driver@example.com",
      failureCode: "API_ERROR",
      failureReason: "API_ERROR",
      retryCount: 1,
      nextRetryAt: new Date(),
      initiatedAt: new Date(),
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue({
      ...payoutDriverProfile,
    });
    global.mockDrizzle.query.payoutRecipient.findFirst.mockResolvedValue({
      id: "recipient-1",
      driverId: "driver-1",
      provider: "kora",
      recipientCode: "1234567890",
      providerRecipientId: "058",
      bankCode: "058",
      bankName: "GTBank",
      accountName: "Jane Driver",
      accountNumberLast4: "7890",
      detailsFingerprint: recipientFingerprint,
      status: "active",
      rawResponse: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockKoraHttp.post.mockResolvedValue({
      data: {
        status: true,
        message: "Unused",
        data: {},
      },
    });
    global.mockKoraHttp.get.mockResolvedValue({
      data: {
        status: true,
        message: "Balance fetched",
        data: {
          NGN: {
            available_balance: "5000.00",
            pending_balance: "0.00",
          },
        },
      },
    });
    mockUpdateReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "failed",
      driverEmail: "driver@example.com",
      failureCode: "API_ERROR",
      failureReason: "API_ERROR",
      retryCount: 1,
      nextRetryAt: new Date(),
      initiatedAt: new Date(),
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockDrizzle.query.payoutAttempt.findFirst
      .mockResolvedValueOnce({
        id: "attempt-1",
        payoutId: "payout-1",
        attemptNumber: 1,
        koraReference: "DX-PO-123_attempt_1",
        status: "settled",
        failureReason: null,
        initiatedAt: new Date(),
        settledAt: new Date(),
        rawWebhook: {},
      })
      .mockResolvedValueOnce(undefined);

    await payoutService.triggerPayout("earning-1");

    expect(global.mockKoraHttp.post).not.toHaveBeenCalled();
  });

  it("settles a payout from the Kora webhook, records the fee, and ignores duplicate webhook deliveries", async () => {
    const event = {
      event: "transfer.success",
      data: {
        reference: "DX-PO-123_attempt_1",
        amount: 180,
        fee: "2.50",
        currency: "NGN",
        status: "success",
      },
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    const signature = createHmac(
      "sha256",
      process.env.KORA_WEBHOOK_SECRET as string,
    )
      .update(JSON.stringify(event.data))
      .digest("hex");

    mockInsertReturning({ id: "webhook-1" });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValueOnce({
      id: "attempt-1",
      payoutId: "payout-1",
      attemptNumber: 1,
      koraReference: "DX-PO-123_attempt_1",
      status: "pending",
      failureReason: null,
      initiatedAt: new Date(),
      settledAt: null,
      rawWebhook: null,
    });
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: new Date(),
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const settledAttemptUpdate = mockTxUpdateWithoutReturning();
    const settledPayoutUpdate = mockTxUpdateWithoutReturning();
    const settledEarningUpdate = mockTxUpdateWithoutReturning();
    mockUpdateWithoutReturning();

    await payoutService.processWebhook({
      signature,
      rawBody,
      event,
    });

    expect(settledAttemptUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "settled",
        rawWebhook: event,
      }),
    );
    expect(settledPayoutUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        koraFeeAmount: 250,
        failureCode: null,
        failureReason: null,
        rawFinalStatusResponse: event,
      }),
    );
    expect(settledEarningUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        payoutId: "payout-1",
      }),
    );

    mockInsertReturning({ id: "webhook-2" });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValueOnce({
      id: "attempt-1",
      payoutId: "payout-1",
      attemptNumber: 1,
      koraReference: "DX-PO-123_attempt_1",
      status: "settled",
      failureReason: null,
      initiatedAt: new Date(),
      settledAt: new Date(),
      rawWebhook: {},
    });
    mockUpdateWithoutReturning();

    await payoutService.processWebhook({
      signature,
      rawBody,
      event,
    });

    expect(settledAttemptUpdate.set).toHaveBeenCalledTimes(1);
    expect(settledPayoutUpdate.set).toHaveBeenCalledTimes(1);
    expect(settledEarningUpdate.set).toHaveBeenCalledTimes(1);
  });

  it("retries a payout when the Kora webhook reports a retryable failure", async () => {
    const event = {
      event: "transfer.failed",
      data: {
        reference: "DX-PO-123_attempt_1",
        amount: 180,
        fee: "0.00",
        currency: "NGN",
        status: "failed",
        message: "Timeout waiting for response",
      },
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    const signature = createHmac(
      "sha256",
      process.env.KORA_WEBHOOK_SECRET as string,
    )
      .update(JSON.stringify(event.data))
      .digest("hex");

    mockInsertReturning({ id: "webhook-3" });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValueOnce({
      id: "attempt-1",
      payoutId: "payout-1",
      attemptNumber: 1,
      koraReference: "DX-PO-123_attempt_1",
      status: "pending",
      failureReason: null,
      initiatedAt: new Date(),
      settledAt: null,
      rawWebhook: null,
    });
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: new Date(),
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    mockUpdateWithoutReturning();
    const retryEarningUpdate = mockUpdateWithoutReturning();
    mockUpdateWithoutReturning();

    await payoutService.processWebhook({
      signature,
      rawBody,
      event,
    });

    expect(global.mockBoss.sendAfter).toHaveBeenCalledWith(
      "process-payout",
      { earningId: "earning-1" },
      expect.objectContaining({ singletonKey: "earning-1", retryLimit: 0 }),
      60,
    );
    expect(retryEarningUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "processing",
        payoutId: "payout-1",
      }),
    );
  });

  it("settles a late success webhook after an earlier timeout and skips the queued retry", async () => {
    const failureEvent = {
      event: "transfer.failed",
      data: {
        reference: "DX-PO-123_attempt_1",
        amount: 180,
        fee: "0.00",
        currency: "NGN",
        status: "failed",
        message: "Timeout waiting for response",
      },
    };
    const successEvent = {
      event: "transfer.success",
      data: {
        reference: "DX-PO-123_attempt_1",
        amount: 180,
        fee: "2.50",
        currency: "NGN",
        status: "success",
      },
    };

    const failureRawBody = Buffer.from(JSON.stringify(failureEvent));
    const successRawBody = Buffer.from(JSON.stringify(successEvent));
    const signature = createHmac(
      "sha256",
      process.env.KORA_WEBHOOK_SECRET as string,
    )
      .update(JSON.stringify(failureEvent.data))
      .digest("hex");
    const successSignature = createHmac(
      "sha256",
      process.env.KORA_WEBHOOK_SECRET as string,
    )
      .update(JSON.stringify(successEvent.data))
      .digest("hex");

    mockInsertReturning({ id: "webhook-timeout" });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValueOnce({
      id: "attempt-1",
      payoutId: "payout-1",
      attemptNumber: 1,
      koraReference: "DX-PO-123_attempt_1",
      status: "pending",
      failureReason: null,
      initiatedAt: new Date(),
      settledAt: null,
      rawWebhook: null,
    });
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 0,
      nextRetryAt: null,
      initiatedAt: new Date(),
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    mockUpdateWithoutReturning();
    mockUpdateWithoutReturning();
    mockUpdateWithoutReturning();

    await payoutService.processWebhook({
      signature,
      rawBody: failureRawBody,
      event: failureEvent,
    });

    expect(global.mockBoss.sendAfter).toHaveBeenCalledTimes(1);

    mockInsertReturning({ id: "webhook-late-success" });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValueOnce({
      id: "attempt-1",
      payoutId: "payout-1",
      attemptNumber: 1,
      koraReference: "DX-PO-123_attempt_1",
      status: "failed",
      failureReason: "Timeout waiting for response",
      initiatedAt: new Date(),
      settledAt: null,
      rawWebhook: failureEvent,
    });
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "failed",
      driverEmail: "driver@example.com",
      failureCode: "API_ERROR",
      failureReason: "API_ERROR",
      retryCount: 1,
      nextRetryAt: new Date(),
      initiatedAt: new Date(),
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: failureEvent,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockTxUpdateWithoutReturning();
    mockTxUpdateWithoutReturning();
    mockTxUpdateWithoutReturning();
    const manualReviewUpdate = mockUpdateWithoutReturning();
    mockUpdateWithoutReturning();

    await payoutService.processWebhook({
      signature: successSignature,
      rawBody: successRawBody,
      event: successEvent,
    });

    expect(mockedEmitPayoutCompleted).toHaveBeenCalledWith({
      payoutId: "payout-1",
      driverId: "driver-1",
      reference: "DX-PO-123",
      amountMinor: 18000,
      currency: "NGN",
    });

    global.mockDrizzle.query.earning.findFirst.mockResolvedValueOnce({
      id: "earning-1",
      driverId: "driver-1",
      netAmountMinor: 18000,
      currency: "NGN",
      status: "paid",
    } as any);

    await payoutService.triggerPayout("earning-1");

    expect(global.mockKoraHttp.post).not.toHaveBeenCalled();
    expect(global.mockBoss.sendAfter).toHaveBeenCalledTimes(1);
  });

  it("permanently fails a payout from the webhook when retries are exhausted", async () => {
    const event = {
      event: "transfer.failed",
      data: {
        reference: "DX-PO-123_attempt_4",
        amount: 180,
        fee: "0.00",
        currency: "NGN",
        status: "failed",
        message: "Destination bank unavailable",
      },
    };
    const rawBody = Buffer.from(JSON.stringify(event));
    const signature = createHmac(
      "sha256",
      process.env.KORA_WEBHOOK_SECRET as string,
    )
      .update(JSON.stringify(event.data))
      .digest("hex");

    mockInsertReturning({ id: "webhook-4" });
    global.mockDrizzle.query.payoutAttempt.findFirst.mockResolvedValueOnce({
      id: "attempt-4",
      payoutId: "payout-1",
      attemptNumber: 4,
      koraReference: "DX-PO-123_attempt_4",
      status: "pending",
      failureReason: null,
      initiatedAt: new Date(),
      settledAt: null,
      rawWebhook: null,
    });
    global.mockDrizzle.query.payout.findFirst.mockResolvedValueOnce({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "processing",
      driverEmail: "driver@example.com",
      failureCode: null,
      failureReason: null,
      retryCount: 3,
      nextRetryAt: null,
      initiatedAt: new Date(),
      settledAt: null,
      failedAt: null,
      rawInitiateResponse: null,
      rawFinalStatusResponse: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockUpdateWithoutReturning();
    const permanentFailureUpdate = mockUpdateReturning({
      id: "payout-1",
      driverId: "driver-1",
      recipientId: "recipient-1",
      earningId: "earning-1",
      reference: "DX-PO-123",
      provider: "kora",
      amountMinor: 18000,
      koraFeeAmount: null,
      currency: "NGN",
      earningsCount: 1,
      status: "permanent_failed",
      driverEmail: "driver@example.com",
      failureCode: "permanent_failed",
      failureReason: "Destination bank unavailable",
      retryCount: 3,
      nextRetryAt: null,
      initiatedAt: new Date(),
      settledAt: null,
      failedAt: new Date(),
      rawInitiateResponse: null,
      rawFinalStatusResponse: event,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    global.mockDrizzle.query.payoutRecipient.findFirst.mockResolvedValue({
      id: "recipient-1",
      driverId: "driver-1",
      bankName: "GTBank",
      accountName: "Jane Driver",
      accountNumberLast4: "7890",
    } as any);
    const manualReviewUpdate = mockUpdateWithoutReturning();
    mockUpdateWithoutReturning();

    await payoutService.processWebhook({
      signature,
      rawBody,
      event,
    });

    expect(permanentFailureUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "permanent_failed",
        failureCode: "Destination bank unavailable",
        failureReason: "Destination bank unavailable",
        rawFinalStatusResponse: event,
      }),
    );
    expect(manualReviewUpdate.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "manual_review",
        payoutId: "payout-1",
      }),
    );
  });

  it("publishes bank verification outcomes", async () => {
    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
    mockInsertWithoutReturning();
    global.mockKoraHttp.post.mockResolvedValueOnce({
      data: {
        status: true,
        message: "Account resolved",
        data: {
          account_name: "Jane Driver",
          account_number: "1234567890",
          bank_name: "GTBank",
          bank_code: "058",
        },
      },
    });

    await payoutService.handleDriverBankVerificationRequested(
      {
        eventId: "evt-bank-1",
        eventType: "driver.bank.verification.requested",
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "driver-service",
        payload: {
          driverId: "driver-1",
          bankName: "GTBank",
          bankCode: "058",
          accountNumber: "1234567890",
          accountName: "Jane Driver",
          currency: "NGN",
        },
      },
      "driver.bank.verification.requested",
    );

    expect(mockedEmitDriverBankVerified).toHaveBeenCalledWith({
      driverId: "driver-1",
      bankName: "GTBank",
      bankCode: "058",
      accountNumber: "1234567890",
      accountName: "Jane Driver",
      currency: "NGN",
    });

    global.mockDrizzle.query.consumedEvent.findFirst.mockResolvedValue(null);
    mockInsertWithoutReturning();
    global.mockKoraHttp.post.mockRejectedValueOnce(
      new Error("Account not found"),
    );

    await payoutService.handleDriverBankVerificationRequested(
      {
        eventId: "evt-bank-2",
        eventType: "driver.bank.verification.requested",
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        source: "driver-service",
        payload: {
          driverId: "driver-1",
          bankName: "GTBank",
          bankCode: "058",
          accountNumber: "1234567890",
          accountName: "Jane Driver",
          currency: "NGN",
        },
      },
      "driver.bank.verification.requested",
    );

    expect(mockedEmitDriverBankVerificationFailed).toHaveBeenCalledWith({
      driverId: "driver-1",
      bankName: "GTBank",
      bankCode: "058",
      accountNumber: "1234567890",
      reason: "Account not found",
      currency: "NGN",
    });
  });

  it("keeps nextAutoPayoutAt null in the balance response", async () => {
    global.mockDrizzle.query.driverPayoutProfile.findFirst.mockResolvedValue({
      ...payoutDriverProfile,
    });
    global.mockDrizzle.query.earning.findMany.mockResolvedValue([]);

    const balance = await payoutService.getBalance(gatewayUser);

    expect(balance.nextAutoPayoutAt).toBeNull();
  });
});
