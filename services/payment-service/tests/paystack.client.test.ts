import { createHmac } from "node:crypto";
import {
  mapPaystackStatusToPaymentStatus,
  verifyPaystackWebhookSignature,
} from "@/paystack.client";

describe("paystack client utilities", () => {
  it("maps Paystack statuses to local payment statuses", () => {
    expect(mapPaystackStatusToPaymentStatus("success")).toBe("successful");
    expect(mapPaystackStatusToPaymentStatus("failed")).toBe("failed");
    expect(mapPaystackStatusToPaymentStatus("reversed")).toBe("failed");
    expect(mapPaystackStatusToPaymentStatus("abandoned")).toBe("cancelled");
    expect(mapPaystackStatusToPaymentStatus("processing")).toBe("pending");
    expect(mapPaystackStatusToPaymentStatus("queued")).toBe("pending");
    expect(mapPaystackStatusToPaymentStatus("unknown")).toBe("initialized");
  });

  it("verifies a valid Paystack webhook signature against the raw body", () => {
    const rawBody = Buffer.from(
      JSON.stringify({
        event: "charge.success",
        data: { reference: "DX-REFERENCE-1" },
      }),
    );
    const secret = "sk_test_paystack_secret";
    const signature = createHmac("sha512", secret)
      .update(rawBody)
      .digest("hex");

    expect(
      verifyPaystackWebhookSignature({
        rawBody,
        signature,
        secret,
      }),
    ).toBe(true);
  });
});
