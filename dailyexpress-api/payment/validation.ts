import Joi from "joi";
import { KORA_CHECKOUT_CHANNELS } from "@shared/types";

const koraChannelSchema = Joi.string().valid(...KORA_CHECKOUT_CHANNELS);

export const initializePaymentSchema = Joi.object({
  bookingId: Joi.string().uuid().required(),
  reference: Joi.string().max(128).optional(),
  currency: Joi.string().uppercase().length(3).default("NGN"),
  channels: Joi.array().items(koraChannelSchema).optional(),
  productName: Joi.string().min(2).max(120).required(),
});


