export async function startWorkers() {
  const [
    { registerPayoutWorker },
    { registerTripRefundWorker },
  ] = await Promise.all([
    import("./payout.worker"),
    import("./trip-refund.worker"),
  ]);

  await Promise.all([
    registerPayoutWorker(),
    registerTripRefundWorker(),
  ]);
}
