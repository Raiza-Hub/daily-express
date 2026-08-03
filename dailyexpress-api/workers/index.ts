export async function startWorkers() {
  const [
    { registerEmailWorker },
    { registerPayoutWorker },
    { registerDriverVerificationWorker },
    { registerTripRefundWorker },
    { registerAllocationWorker },
    { registerTripDriverAssignedWorker },
  ] = await Promise.all([
    import("./email.worker"),
    import("./payout.worker"),
    import("./driver-verification.worker"),
    import("./trip-refund.worker"),
    import("./allocation.worker"),
    import("./trip-driver-assigned.worker"),
  ]);

  await Promise.all([
    registerEmailWorker(),
    registerPayoutWorker(),
    registerDriverVerificationWorker(),
    registerTripRefundWorker(),
    registerAllocationWorker(),
    registerTripDriverAssignedWorker(),
  ]);
}
