import type { BookingCreatedEvent } from "@shared/kafka";
import { paymentService } from "./paymentService";

export async function handleBookingCreated(
  payload: BookingCreatedEvent["payload"],
): Promise<void> {
  await paymentService.handleBookingCreated(payload);
}
