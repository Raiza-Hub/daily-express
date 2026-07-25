export async function startWorkers() {
  const [
    { registerEmailWorker },
    { registerPaymentExpiryWorker },
    { registerPaymentWebhookWorker },
    { registerPayoutWorker },
    { registerDriverVerificationWorker },
    { registerTripRefundWorker },
    { registerAllocationWorker },
    { registerTripDriverAssignedWorker },
  ] = await Promise.all([
    import("./email.worker"),
    import("./payment-expiry.worker"),
    import("./payment-webhook.worker"),
    import("./payout.worker"),
    import("./driver-verification.worker"),
    import("./trip-refund.worker"),
    import("./allocation.worker"),
    import("./trip-driver-assigned.worker"),
  ]);

  await Promise.all([
    registerEmailWorker(),
    registerPaymentExpiryWorker(),
    registerPaymentWebhookWorker(),
    registerPayoutWorker(),
    registerDriverVerificationWorker(),
    registerTripRefundWorker(),
    registerAllocationWorker(),
    registerTripDriverAssignedWorker(),
  ]);
}
