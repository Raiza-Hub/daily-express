import { and, eq } from "drizzle-orm";
import { db } from "../db/connection";
import { payment } from "../db/index";
import { logger } from "../utils/logger";
import type { PaymentRepository } from "./payment.repository";
import type { PaymentStatus } from "./payment.types";

export async function transitionPendingPayment(
  repo: PaymentRepository,
  reference: string,
  nextStatus: Extract<PaymentStatus, "failed" | "cancelled" | "expired">,
  reason: string,
  options?: {
    failureCode?: string;
    providerStatus?: string | null;
  },
) {
  const [claimed] = await repo.claimPayment(reference);
  if (!claimed) {
    logger.warn("payment.transition_already_completed", { reference });
    return null;
  }

  const [record] = await db.transaction(async (tx) => {
    const [r] = await tx
      .update(payment)
      .set({
        status: nextStatus,
        failureReason: reason,
        failureCode: options?.failureCode || null,
        providerStatus: options?.providerStatus || null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(payment.reference, reference), eq(payment.status, "processing")),
      )
      .returning();

    if (!r) return [];

    if (r.bookingId) {
      await repo.updateBookingPaymentStatus(tx, {
        bookingId: r.bookingId,
        paymentReference: reference,
        paymentStatus: nextStatus,
      });
    }

    return [r];
  });

  return record || null;
}
