import z from "zod";
import { KORA_CHECKOUT_CHANNELS } from "@shared/types";

const koraChannel = z.enum(KORA_CHECKOUT_CHANNELS);

export const initializePaymentSchema = z.object({
  bookingId: z.uuid(),
  reference: z.string().max(128).optional(),
  channels: z.array(koraChannel).optional(),
  productName: z.string().min(2).max(120),
});