export async function startWorkers() {
  const [
    { registerPayoutWorker },
    { registerTripRefundWorker },
    { registerEmailWorker },
  ] = await Promise.all([
    import("./payout.worker"),
    import("./trip-refund.worker"),
    import("./email.worker"),
  ]);

  await Promise.all([
    registerPayoutWorker(),
    registerTripRefundWorker(),
    registerEmailWorker(),
  ]);
}
