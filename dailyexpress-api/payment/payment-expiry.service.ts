import { logger } from "../utils/logger";
import { db } from "../db/connection";
import { and, eq } from "drizzle-orm";
import { booking, payment } from "../db/index";
import { PaymentRepository } from "./payment.repository";
import { PaymentConfirmService } from "./payment-confirm.service";
import { PaymentRefundService } from "./payment-refund.service";
import { KoraClient } from "./kora.client";

export class PaymentExpiryService {
  private readonly kora = new KoraClient();

  constructor(
    private repo: PaymentRepository,
    private confirmService: PaymentConfirmService,
    private refundService: PaymentRefundService,
  ) {}

  async expirePayment(payload: { bookingId: string; reference: string }) {
    const [claimed] = await this.repo.lockPaymentForExpiry(payload.reference);

    if (!claimed) {
      logger.info("payment.expire_skipped_concurrent", payload);
      return;
    }

    const verification = await this.kora.verifyTransaction(payload.reference);

    if (verification.data.status.toLowerCase() === "success") {
      const bookingRecord = await db.query.booking.findFirst({
        where: eq(booking.id, payload.bookingId),
        columns: { expiresAt: true },
      });

      if (
        bookingRecord?.expiresAt &&
        bookingRecord.expiresAt.getTime() > Date.now()
      ) {
        await this.confirmService.confirmPayment(
          payload.reference,
          verification.data,
          verification.raw,
        );
        return;
      }

      await this.failExpiredPayment(payload.reference);
      await this.refundService.refundPayment(
        payload.reference,
        verification.data,
        verification.raw,
        "Payment completed after booking hold expired",
      );
      return;
    }

    await this.failExpiredPayment(payload.reference);
  }

  private async failExpiredPayment(reference: string) {
    const [updatedPayment] = await db
      .update(payment)
      .set({
        status: "expired",
        failureCode: "PAYMENT_EXPIRED",
        failureReason: "Seat reservation expired before payment was completed",
        lastStatusCheckAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(eq(payment.reference, reference), eq(payment.status, "pending")),
      )
      .returning();

    if (!updatedPayment) return;

    logger.info("payment.expired", {
      bookingId: updatedPayment.bookingId,
      reference,
    });
  }
}
