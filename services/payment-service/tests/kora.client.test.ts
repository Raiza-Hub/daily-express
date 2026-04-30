import { createHmac } from "node:crypto";
import { KoraClient, mapKoraStatusToPaymentStatus } from "@/kora.client";

describe("kora client utilities", () => {
  it("maps Kora statuses to local payment statuses", () => {
    expect(mapKoraStatusToPaymentStatus("success")).toBe("successful");
    expect(mapKoraStatusToPaymentStatus("failed")).toBe("failed");
    expect(mapKoraStatusToPaymentStatus("abandoned")).toBe("cancelled");
    expect(mapKoraStatusToPaymentStatus("processing")).toBe("pending");
    expect(mapKoraStatusToPaymentStatus("pending")).toBe("pending");
    expect(mapKoraStatusToPaymentStatus("unknown")).toBeNull();
  });

  it("verifies a valid Kora webhook signature against only the data payload", () => {
    const event = {
      event: "charge.success",
      data: {
        status: "success",
        reference: "DX-REFERENCE-1",
        amount: 14300,
        currency: "NGN",
      },
    };
    const secret = process.env.KORA_SECRET_KEY as string;
    const signature = createHmac("sha256", secret)
      .update(JSON.stringify(event.data))
      .digest("hex");

    const client = new KoraClient();

    expect(client.verifyWebhookSignature(event.data, signature)).toBe(true);
  });
});
