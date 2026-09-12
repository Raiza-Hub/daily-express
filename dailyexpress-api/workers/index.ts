export async function startWorkers() {
  const [
    { registerTripRefundWorker },
    { registerEmailWorker },
  ] = await Promise.all([
    import("./trip-refund.worker"),
    import("./email.worker"),
  ]);

  await Promise.all([
    registerTripRefundWorker(),
    registerEmailWorker(),
  ]);
}