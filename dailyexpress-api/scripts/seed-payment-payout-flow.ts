import "dotenv/config";
import { createHash, createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { db } from "../db/connection";

const secretKey = process.env.KORA_SECRET_KEY || "sk_test_dx_seed";
const now = new Date();
const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const future = new Date(now.getTime() + 24 * 60 * 60 * 1000);

const ids = {
  passenger: "11111111-1111-4111-8111-111111111111",
  driver: "22222222-2222-4222-8222-222222222222",
  route: "33333333-3333-4333-8333-333333333333",
  tripSuccess: "44444444-4444-4444-8444-444444444441",
  tripFailed: "44444444-4444-4444-8444-444444444442",
  tripExpired: "44444444-4444-4444-8444-444444444443",
  tripRefund: "44444444-4444-4444-8444-444444444444",
  tripMismatch: "44444444-4444-4444-8444-444444444445",
  tripPayout: "44444444-4444-4444-8444-444444444446",
  recipient: "55555555-5555-4555-8555-555555555555",
};

type PaymentSeedCase = {
  key: string;
  bookingId: string;
  tripId: string;
  reference: string;
  status:
    | "pending"
    | "successful"
    | "failed"
    | "expired"
    | "refund_pending"
    | "refunded"
    | "refund_failed";
  providerStatus: string;
  amount: number;
  expiresAt?: Date;
  paidAt?: Date;
  failedAt?: Date;
  failureCode?: string;
  failureReason?: string;
};

const paymentCases: PaymentSeedCase[] = [
  {
    key: "pending",
    bookingId: "66666666-6666-4666-8666-666666666661",
    tripId: ids.tripSuccess,
    reference: "dx-seed-payment-pending",
    status: "pending",
    providerStatus: "processing",
    amount: 5500,
    expiresAt: future,
  },
  {
    key: "success",
    bookingId: "66666666-6666-4666-8666-666666666662",
    tripId: ids.tripSuccess,
    reference: "dx-seed-payment-success",
    status: "successful",
    providerStatus: "success",
    amount: 5500,
    paidAt: past,
  },
  {
    key: "failed",
    bookingId: "66666666-6666-4666-8666-666666666663",
    tripId: ids.tripFailed,
    reference: "dx-seed-payment-failed-insufficient-funds",
    status: "failed",
    providerStatus: "failed",
    amount: 5500,
    failedAt: past,
    failureCode: "insufficient_funds",
    failureReason: "Kora sandbox failed card: insufficient funds",
  },
  {
    key: "expired",
    bookingId: "66666666-6666-4666-8666-666666666664",
    tripId: ids.tripExpired,
    reference: "dx-seed-payment-expired",
    status: "expired",
    providerStatus: "expired",
    amount: 5500,
    failedAt: past,
    expiresAt: past,
    failureCode: "seat_hold_expired",
    failureReason: "Seat reservation expired before payment completed",
  },
  {
    key: "refund-pending",
    bookingId: "66666666-6666-4666-8666-666666666665",
    tripId: ids.tripRefund,
    reference: "dx-seed-payment-refund-pending",
    status: "refund_pending",
    providerStatus: "success",
    amount: 5500,
    paidAt: past,
  },
  {
    key: "refunded",
    bookingId: "66666666-6666-4666-8666-666666666666",
    tripId: ids.tripRefund,
    reference: "dx-seed-payment-refunded",
    status: "refunded",
    providerStatus: "success",
    amount: 5500,
    paidAt: past,
  },
  {
    key: "refund-failed",
    bookingId: "66666666-6666-4666-8666-666666666667",
    tripId: ids.tripRefund,
    reference: "dx-seed-payment-refund-failed",
    status: "refund_failed",
    providerStatus: "success",
    amount: 5500,
    paidAt: past,
    failureCode: "refund_failed",
    failureReason: "Kora sandbox refund failure fixture",
  },
  {
    key: "amount-mismatch",
    bookingId: "66666666-6666-4666-8666-666666666668",
    tripId: ids.tripMismatch,
    reference: "dx-seed-payment-amount-mismatch",
    status: "failed",
    providerStatus: "success",
    amount: 5500,
    failedAt: past,
    failureCode: "amount_mismatch",
    failureReason: "Verified Kora amount did not match booking total",
  },
  {
    key: "currency-mismatch",
    bookingId: "66666666-6666-4666-8666-666666666669",
    tripId: ids.tripMismatch,
    reference: "dx-seed-payment-currency-mismatch",
    status: "failed",
    providerStatus: "success",
    amount: 5500,
    failedAt: past,
    failureCode: "currency_mismatch",
    failureReason: "Verified Kora currency did not match booking currency",
  },
];

type PayoutSeedCase = {
  key: string;
  earningId: string;
  bookingId: string;
  payoutId: string;
  reference: string;
  status: "processing" | "success" | "failed" | "permanent_failed";
  earningStatus:
    | "pending_trip_completion"
    | "available"
    | "reserved"
    | "processing"
    | "paid"
    | "cancelled"
    | "manual_review";
  bankCode: string;
  accountNumberLast4: string;
  settledAt?: Date;
  failedAt?: Date;
  nextRetryAt?: Date;
  retryCount?: number;
  failureCode?: string;
  failureReason?: string;
};

const payoutCases: PayoutSeedCase[] = [
  {
    key: "success",
    earningId: "77777777-7777-4777-8777-777777777771",
    bookingId: paymentCases[1].bookingId,
    payoutId: "88888888-8888-4888-8888-888888888881",
    reference: "dx-seed-payout-success-033",
    status: "success",
    earningStatus: "paid",
    bankCode: "033",
    accountNumberLast4: "0000",
    settledAt: past,
  },
  {
    key: "failed",
    earningId: "77777777-7777-4777-8777-777777777772",
    bookingId: "66666666-6666-4666-8666-666666666672",
    payoutId: "88888888-8888-4888-8888-888888888882",
    reference: "dx-seed-payout-failed-035",
    status: "permanent_failed",
    earningStatus: "manual_review",
    bankCode: "035",
    accountNumberLast4: "0000",
    failedAt: past,
    failureCode: "sandbox_failed_payout",
    failureReason: "Kora sandbox failed payout bank code 035",
  },
  {
    key: "invalid-account",
    earningId: "77777777-7777-4777-8777-777777777773",
    bookingId: "66666666-6666-4666-8666-666666666673",
    payoutId: "88888888-8888-4888-8888-888888888883",
    reference: "dx-seed-payout-invalid-account-011",
    status: "permanent_failed",
    earningStatus: "manual_review",
    bankCode: "011",
    accountNumberLast4: "9999",
    failedAt: past,
    failureCode: "invalid_account",
    failureReason: "Kora sandbox invalid account 011/9999999999",
  },
  {
    key: "retryable",
    earningId: "77777777-7777-4777-8777-777777777774",
    bookingId: "66666666-6666-4666-8666-666666666674",
    payoutId: "88888888-8888-4888-8888-888888888884",
    reference: "dx-seed-payout-retryable-processing",
    status: "processing",
    earningStatus: "processing",
    bankCode: "033",
    accountNumberLast4: "0000",
    nextRetryAt: future,
    retryCount: 2,
    failureCode: "provider_timeout",
    failureReason: "Retryable provider timeout fixture",
  },
  {
    key: "already-paid",
    earningId: "77777777-7777-4777-8777-777777777775",
    bookingId: "66666666-6666-4666-8666-666666666675",
    payoutId: "88888888-8888-4888-8888-888888888885",
    reference: "dx-seed-payout-already-paid",
    status: "success",
    earningStatus: "paid",
    bankCode: "033",
    accountNumberLast4: "0000",
    settledAt: past,
  },
  {
    key: "cancelled",
    earningId: "77777777-7777-4777-8777-777777777776",
    bookingId: "66666666-6666-4666-8666-666666666676",
    payoutId: "88888888-8888-4888-8888-888888888886",
    reference: "dx-seed-payout-cancelled-earning",
    status: "failed",
    earningStatus: "cancelled",
    bankCode: "033",
    accountNumberLast4: "0000",
    failedAt: past,
    failureCode: "trip_cancelled",
    failureReason: "Trip was cancelled before payout",
  },
];

function hashSignature(data: unknown) {
  return createHmac("sha256", secretKey)
    .update(JSON.stringify(data))
    .digest("hex");
}

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dbDate(value?: Date | null) {
  return value ? value.toISOString() : null;
}

function paymentWebhookPayload(reference: string, status: "success" | "failed") {
  return {
    event: status === "success" ? "charge.success" : "charge.failed",
    data: {
      fee: 150,
      amount: 5500,
      status,
      currency: "NGN",
      reference,
      payment_reference: reference,
      payment_method: "card",
      sandbox_cards: {
        success_no_auth_visa: "4084127883172787",
        failed_insufficient_funds_verve: "506066506066506067",
      },
    },
  };
}

function payoutWebhookPayload(reference: string, status: "success" | "failed") {
  return {
    event: status === "success" ? "transfer.success" : "transfer.failed",
    data: {
      fee: 15,
      amount: 4500,
      status,
      currency: "NGN",
      reference,
    },
  };
}

async function seed() {
  await db.execute(sql`
    INSERT INTO users (
      id, first_name, last_name, email, password, date_of_birth,
      email_verified, referal, created_at, updated_at
    )
    VALUES
      (${ids.passenger}::uuid, 'Seed', 'Passenger', 'dx-seed-passenger@example.com', null, '1995-01-01', true, 'dx-seed', now(), now()),
      (${ids.driver}::uuid, 'Seed', 'Driver', 'dx-seed-driver@example.com', null, '1990-01-01', true, 'dx-seed', now(), now())
    ON CONFLICT (id) DO UPDATE SET
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      email = excluded.email,
      email_verified = excluded.email_verified,
      updated_at = now()
  `);

  await db.execute(sql`
    INSERT INTO driver (
      id, user_id, first_name, last_name, email, profile_picture, phone,
      country, currency, state, city, address, bank_name, bank_code,
      account_number, account_name, bank_verification_status,
      bank_verification_failure_reason, bank_verification_requested_at,
      bank_verified_at, is_active, created_at, updated_at
    )
    VALUES (
      ${ids.driver}::uuid, ${ids.driver}::uuid, 'Seed', 'Driver',
      'dx-seed-driver@example.com',
      'https://res.cloudinary.com/demo/image/upload/v1700000000/daily-express/drivers/dx-seed-old-profile.jpg',
      '+2348000000000', 'Nigeria', 'NGN', 'Lagos', 'Lagos',
      '1 Seed Street, Lagos', 'UBA', '033', '0000000000',
      'SEED DRIVER', 'active', null, ${dbDate(past)}, ${dbDate(past)}, true, now(), now()
    )
    ON CONFLICT (id) DO UPDATE SET
      bank_code = excluded.bank_code,
      account_number = excluded.account_number,
      bank_verification_status = excluded.bank_verification_status,
      updated_at = now()
  `);

  await db.execute(sql`
    INSERT INTO driver_stats (
      driver_id, total_earnings, pending_payments, total_passengers,
      active_routes, created_at, updated_at
    )
    VALUES (${ids.driver}::uuid, 9000, 4500, 9, 1, now(), now())
    ON CONFLICT (driver_id) DO UPDATE SET
      total_earnings = excluded.total_earnings,
      pending_payments = excluded.pending_payments,
      total_passengers = excluded.total_passengers,
      active_routes = excluded.active_routes,
      updated_at = now()
  `);

  await db.execute(sql`
    INSERT INTO route (
      id, driver_id, pickup_location_title, pickup_location_locality,
      pickup_location_label, dropoff_location_title, dropoff_location_locality,
      dropoff_location_label, vehicle_type, meeting_point, available_seats,
      price, departure_time, arrival_time, status, created_at, updated_at
    )
    VALUES (
      ${ids.route}::uuid, ${ids.driver}::uuid, 'Lekki Phase 1', 'Lekki',
      'Lekki Phase 1, Lagos', 'Yaba Bus Stop', 'Yaba',
      'Yaba, Lagos', 'car', 'Seed route meeting point', 4, 5000,
      ${dbDate(future)}, ${dbDate(new Date(future.getTime() + 60 * 60 * 1000))}, 'active',
      now(), now()
    )
    ON CONFLICT (id) DO UPDATE SET updated_at = now()
  `);

  const tripRows = [
    ids.tripSuccess,
    ids.tripFailed,
    ids.tripExpired,
    ids.tripRefund,
    ids.tripMismatch,
    ids.tripPayout,
  ];

  for (const [index, tripId] of tripRows.entries()) {
    await db.execute(sql`
      INSERT INTO trip (
        id, route_id, driver_id, date, capacity, booked_seats,
        status, created_at, updated_at
      )
      VALUES (
        ${tripId}::uuid, ${ids.route}::uuid, ${ids.driver}::uuid,
        ${dbDate(new Date(future.getTime() + index * 24 * 60 * 60 * 1000))},
        4, 1, ${index === 5 ? "completed" : "confirmed"}, now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        booked_seats = excluded.booked_seats,
        status = excluded.status,
        updated_at = now()
    `);
  }

  for (const paymentCase of paymentCases) {
    const bookingStatus =
      paymentCase.status === "pending"
        ? "pending"
        : paymentCase.status === "failed" || paymentCase.status === "expired"
          ? "cancelled"
          : "completed";

    await db.execute(sql`
      INSERT INTO booking (
        id, trip_id, user_id, seat_number, last_name, fare_amount, currency,
        status, expires_at, payment_reference, payment_status, created_at,
        updated_at
      )
      VALUES (
        ${paymentCase.bookingId}::uuid, ${paymentCase.tripId}::uuid,
        ${ids.passenger}::uuid, null, 'Passenger', 5000, 'NGN',
        ${bookingStatus},
        ${dbDate(paymentCase.expiresAt)}, ${paymentCase.reference},
        ${paymentCase.status}, now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        payment_reference = excluded.payment_reference,
        payment_status = excluded.payment_status,
        fare_amount = excluded.fare_amount,
        currency = excluded.currency,
        status = excluded.status,
        expires_at = excluded.expires_at,
        updated_at = now()
    `);

    await db.execute(sql`
      INSERT INTO payment (
        user_id, booking_id, provider, reference, provider_transaction_id,
        amount, currency, product_name, product_description, customer_name,
        customer_email, customer_mobile, status, provider_status, checkout_url,
        checkout_token, redirect_url, cancel_url, channels,
        raw_initialize_response, raw_verification_response, metadata,
        last_status_check_at, paid_at, failed_at, failure_code,
        failure_reason, created_at, updated_at
      )
      VALUES (
        ${ids.passenger}::uuid, ${paymentCase.bookingId}::uuid, 'kora',
        ${paymentCase.reference}, ${`kora-${paymentCase.reference}`},
        ${paymentCase.amount}, 'NGN', 'Daily Express seed booking',
        'Reusable payment/payout edge-case seed', 'Seed Passenger',
        'dx-seed-passenger@example.com', '+2348000000001', ${paymentCase.status},
        ${paymentCase.providerStatus}, ${`https://checkout.korapay.com/${paymentCase.reference}/pay`},
        ${`token-${paymentCase.reference}`}, 'http://localhost:3000/trip-status',
        null, '["card","bank_transfer"]'::jsonb,
        ${JSON.stringify({ status: true, data: { reference: paymentCase.reference } })}::jsonb,
        ${JSON.stringify({ status: paymentCase.providerStatus, reference: paymentCase.reference })}::jsonb,
        ${JSON.stringify({ seed: true, case: paymentCase.key })}::jsonb,
        now(), ${dbDate(paymentCase.paidAt)}, ${dbDate(paymentCase.failedAt)},
        ${paymentCase.failureCode || null}, ${paymentCase.failureReason || null},
        now(), now()
      )
      ON CONFLICT (reference) DO UPDATE SET
        status = excluded.status,
        provider_status = excluded.provider_status,
        raw_verification_response = excluded.raw_verification_response,
        failure_code = excluded.failure_code,
        failure_reason = excluded.failure_reason,
        updated_at = now()
    `);

    if (paymentCase.expiresAt) {
      await db.execute(sql`
        INSERT INTO booking_hold (
          booking_id, trip_id, user_id, expires_at, pg_boss_job_id,
          created_at, updated_at
        )
        VALUES (
          ${paymentCase.bookingId}::uuid, ${paymentCase.tripId}::uuid,
          ${ids.passenger}::uuid, ${dbDate(paymentCase.expiresAt)},
          ${`dx-seed-expire-${paymentCase.key}`}, now(), now()
        )
        ON CONFLICT (booking_id) DO UPDATE SET
          expires_at = excluded.expires_at,
          pg_boss_job_id = excluded.pg_boss_job_id,
          updated_at = now()
      `);
    }
  }

  const validPaymentWebhook = paymentWebhookPayload("dx-seed-payment-success", "success");
  const failedPaymentWebhook = paymentWebhookPayload(
    "dx-seed-payment-failed-insufficient-funds",
    "failed",
  );

  for (const [index, fixture] of [
    { payload: validPaymentWebhook, signatureValid: true, note: "valid success" },
    { payload: validPaymentWebhook, signatureValid: true, note: "duplicate success" },
    { payload: failedPaymentWebhook, signatureValid: true, note: "valid failed" },
    { payload: validPaymentWebhook, signatureValid: false, note: "invalid signature" },
  ].entries()) {
    await db.execute(sql`
      INSERT INTO payment_webhook (
        payment_reference, event_type, signature_valid, payload,
        verification_note, processed_at, created_at
      )
      VALUES (
        ${fixture.payload.data.payment_reference},
        ${fixture.payload.event},
        ${fixture.signatureValid},
        ${JSON.stringify({
          ...fixture.payload,
          signature: fixture.signatureValid
            ? hashSignature(fixture.payload.data)
            : "invalid-dx-seed-signature",
        })}::jsonb,
        ${`dx-seed ${fixture.note}`},
        now(),
        ${dbDate(new Date(now.getTime() + index))}
      )
      ON CONFLICT DO NOTHING
    `);
  }

  await db.execute(sql`
    INSERT INTO payout_recipient (
      id, driver_id, provider, recipient_code, provider_recipient_id,
      bank_code, bank_name, account_name, account_number_last4,
      details_fingerprint, status, raw_response, created_at, updated_at
    )
    VALUES (
      ${ids.recipient}::uuid, ${ids.driver}::uuid, 'kora',
      'dx-seed-recipient-033', 'dx-seed-provider-recipient',
      '033', 'UBA', 'SEED DRIVER', '0000',
      'dx-seed-fingerprint-033-0000', 'active',
      ${JSON.stringify({ sandbox: true, account: "033/0000000000" })}::jsonb,
      now(), now()
    )
    ON CONFLICT (driver_id) DO UPDATE SET
      bank_code = excluded.bank_code,
      raw_response = excluded.raw_response,
      updated_at = now()
  `);

  for (const payoutCase of payoutCases) {
    await db.execute(sql`
      INSERT INTO booking (
        id, trip_id, user_id, seat_number, last_name, fare_amount, currency,
        status, expires_at, payment_reference, payment_status, created_at,
        updated_at
      )
      VALUES (
        ${payoutCase.bookingId}::uuid, ${ids.tripPayout}::uuid,
        ${ids.passenger}::uuid, null, 'Passenger', 50, 'NGN',
        ${payoutCase.earningStatus === "cancelled" ? "cancelled" : "completed"},
        null, ${`dx-seed-booking-${payoutCase.key}`}, 'successful', now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        fare_amount = excluded.fare_amount,
        currency = excluded.currency,
        status = excluded.status,
        payment_status = excluded.payment_status,
        updated_at = now()
    `);

    await db.execute(sql`
      INSERT INTO earning (
        id, driver_id, booking_id, trip_id, route_id, trip_date,
        pickup_title, dropoff_title, gross_amount_minor, fee_amount_minor,
        net_amount_minor, currency, status, source_event_id, payout_id,
        available_at, created_at, updated_at
      )
      VALUES (
        ${payoutCase.earningId}::uuid, ${ids.driver}::uuid,
        ${payoutCase.bookingId}::uuid, ${ids.tripPayout}::uuid,
        ${ids.route}::uuid, ${dbDate(future)}, 'Lekki Phase 1', 'Yaba Bus Stop',
        5000, 500, 4500, 'NGN', ${payoutCase.earningStatus},
        ${`dx-seed-earning-${payoutCase.key}`}, ${payoutCase.payoutId}::uuid,
        ${dbDate(past)}, now(), now()
      )
      ON CONFLICT (id) DO UPDATE SET
        status = excluded.status,
        payout_id = excluded.payout_id,
        updated_at = now()
    `);

    await db.execute(sql`
      INSERT INTO payout (
        id, driver_id, earning_id, recipient_id, reference, provider,
        provider_transfer_code, provider_transfer_id, amount_minor,
        kora_fee_amount, currency, earnings_count, status, driver_email,
        failure_code, failure_reason, retry_count, next_retry_at,
        initiated_at, settled_at, failed_at, raw_initiate_response,
        raw_final_status_response, created_at, updated_at
      )
      VALUES (
        ${payoutCase.payoutId}::uuid, ${ids.driver}::uuid,
        ${payoutCase.earningId}::uuid, ${ids.recipient}::uuid,
        ${payoutCase.reference}, 'kora', ${`trf-${payoutCase.key}`},
        ${`provider-${payoutCase.key}`}, 4500, 15, 'NGN', 1,
        ${payoutCase.status}, 'dx-seed-driver@example.com',
        ${payoutCase.failureCode || null}, ${payoutCase.failureReason || null},
        ${payoutCase.retryCount || 0}, ${dbDate(payoutCase.nextRetryAt)},
        ${dbDate(past)}, ${dbDate(payoutCase.settledAt)}, ${dbDate(payoutCase.failedAt)},
        ${JSON.stringify({
          sandbox: true,
          bankCode: payoutCase.bankCode,
          accountNumberLast4: payoutCase.accountNumberLast4,
        })}::jsonb,
        ${JSON.stringify({ status: payoutCase.status, reference: payoutCase.reference })}::jsonb,
        now(), now()
      )
      ON CONFLICT (reference) DO UPDATE SET
        status = excluded.status,
        failure_code = excluded.failure_code,
        failure_reason = excluded.failure_reason,
        retry_count = excluded.retry_count,
        next_retry_at = excluded.next_retry_at,
        raw_final_status_response = excluded.raw_final_status_response,
        updated_at = now()
    `);

    await db.execute(sql`
      INSERT INTO payout_attempt (
        payout_id, attempt_number, kora_reference, status, failure_reason,
        kora_fee_amount, initiated_at, settled_at, raw_webhook
      )
      VALUES (
        ${payoutCase.payoutId}::uuid, 1, ${payoutCase.reference},
        ${payoutCase.status === "success" ? "success" : "failed"},
        ${payoutCase.failureReason || null}, 15, ${dbDate(past)},
        ${dbDate(payoutCase.settledAt)},
        ${JSON.stringify(
          payoutWebhookPayload(
            payoutCase.reference,
            payoutCase.status === "success" ? "success" : "failed",
          ),
        )}::jsonb
      )
      ON CONFLICT (kora_reference) DO UPDATE SET
        status = excluded.status,
        failure_reason = excluded.failure_reason,
        raw_webhook = excluded.raw_webhook
    `);

    const webhook = payoutWebhookPayload(
      payoutCase.reference,
      payoutCase.status === "success" ? "success" : "failed",
    );

    await db.execute(sql`
      INSERT INTO payout_webhook (
        event_type, reference, signature_valid, payload, processed_at, created_at
      )
      VALUES (
        ${webhook.event}, ${payoutCase.reference}, true,
        ${JSON.stringify({
          ...webhook,
          signature: hashSignature(webhook.data),
        })}::jsonb,
        now(), now()
      )
      ON CONFLICT DO NOTHING
    `);
  }

  const notifications = [
    {
      key: "dx-seed-payment-success",
      type: "seed_payment_success",
      title: "Seed payment successful",
      message: "Dummy successful payment is ready for testing.",
      tone: "positive",
    },
    {
      key: "dx-seed-payout-failed",
      type: "seed_payout_failed",
      title: "Seed payout failed",
      message: "Dummy failed payout is ready for manual review testing.",
      tone: "critical",
    },
  ] as const;

  for (const item of notifications) {
    const payload = {
      type: item.type,
      title: item.title,
      message: item.message,
      tone: item.tone,
    };
    await db.execute(sql`
      INSERT INTO notification (
        driver_id, notification_key, kind, type, title, message, href,
        tag, tone, metadata, content_hash, occurred_at, created_at, updated_at
      )
      VALUES (
        ${ids.driver}::uuid, ${item.key}, 'event', ${item.type},
        ${item.title}, ${item.message}, '/payouts', 'Seed',
        ${item.tone}, ${JSON.stringify({ seed: true })}::jsonb,
        ${contentHash(payload)}, now(), now(), now()
      )
      ON CONFLICT (driver_id, notification_key) DO UPDATE SET
        title = excluded.title,
        message = excluded.message,
        tone = excluded.tone,
        metadata = excluded.metadata,
        content_hash = excluded.content_hash,
        updated_at = now()
    `);
  }

  console.log("Seeded dailyexpress-api payment/payout edge-case data.");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Failed to seed payment/payout flow data:", error);
  process.exit(1);
});
