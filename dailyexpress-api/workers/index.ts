export async function startWorkers() {
  const [
    { registerEmailWorker },
    { registerPaymentWebhookWorker },
    { registerPayoutWorker },
    { registerDriverVerificationWorker },
    { registerTripRefundWorker },
    { registerAllocationWorker },
    { registerTripDriverAssignedWorker },
  ] = await Promise.all([
    import("./email.worker"),
    import("./payment-webhook.worker"),
    import("./payout.worker"),
    import("./driver-verification.worker"),
    import("./trip-refund.worker"),
    import("./allocation.worker"),
    import("./trip-driver-assigned.worker"),
  ]);

  await Promise.all([
    registerEmailWorker(),
    registerPaymentWebhookWorker(),
    registerPayoutWorker(),
    registerDriverVerificationWorker(),
    registerTripRefundWorker(),
    registerAllocationWorker(),
    registerTripDriverAssignedWorker(),
  ]);
}
