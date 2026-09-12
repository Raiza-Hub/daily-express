export async function startWorkers() {
  const [
    { registerTripRefundWorker },
    { registerEmailWorker },
    { registerPayerInfoWorker },
  ] = await Promise.all([
    import("./trip-refund.worker"),
    import("./email.worker"),
    import("./payer-info.worker"),
  ]);

  await Promise.all([
    registerTripRefundWorker(),
    registerEmailWorker(),
    registerPayerInfoWorker(),
  ]);
}