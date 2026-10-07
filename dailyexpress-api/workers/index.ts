export async function startWorkers() {
  const [
    { registerTripRefundWorker },
    { registerEmailWorker },
    { registerPayerInfoWorker },
    { registerTripDispatchWorker },
  ] = await Promise.all([
    import("./trip-refund.worker"),
    import("./email.worker"),
    import("./payer-info.worker"),
    import("../dispatch/trip-dispatch.worker"),
  ]);

  await Promise.all([
    registerTripRefundWorker(),
    registerEmailWorker(),
    registerPayerInfoWorker(),
    registerTripDispatchWorker(),
  ]);
}