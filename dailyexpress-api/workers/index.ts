export { getBoss, stopBoss } from "./boss";
export { registerEmailWorker } from "./email.worker";
export { registerPaymentExpiryWorker } from "./payment-expiry.worker";
export { registerPaymentWebhookWorker } from "./payment-webhook.worker";
export { registerPayoutWorker } from "./payout.worker";
export { registerBankVerificationWorker } from "./bank-verification.worker";
export { registerDriverProfileUploadWorker } from "./driver-profile-upload.worker";

export async function startWorkers() {
  const { registerEmailWorker } = await import("./email.worker");
  const { registerPaymentExpiryWorker } = await import(
    "./payment-expiry.worker"
  );
  const { registerPaymentWebhookWorker } = await import(
    "./payment-webhook.worker"
  );
  const { registerPayoutWorker } = await import("./payout.worker");
  const { registerBankVerificationWorker } = await import(
    "./bank-verification.worker"
  );
  const { registerDriverProfileUploadWorker } = await import(
    "./driver-profile-upload.worker"
  );

  await Promise.all([
    registerEmailWorker(),
    registerPaymentExpiryWorker(),
    registerPaymentWebhookWorker(),
    registerPayoutWorker(),
    registerBankVerificationWorker(),
    registerDriverProfileUploadWorker(),
  ]);
}
