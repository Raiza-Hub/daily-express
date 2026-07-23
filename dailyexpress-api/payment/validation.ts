import Joi from "joi";
import { KORA_CHECKOUT_CHANNELS } from "@shared/types";

const koraChannelSchema = Joi.string().valid(...KORA_CHECKOUT_CHANNELS);

export const initializePaymentSchema = Joi.object({
  bookingId: Joi.string().uuid().required(),
  reference: Joi.string().max(128).optional(),
  currency: Joi.string().uppercase().length(3).default("NGN"),
  channels: Joi.array().items(koraChannelSchema).optional(),
  productName: Joi.string().min(2).max(120).required(),
  customerName: Joi.string().max(120).optional(),
});

export const koraWebhookSchema = Joi.object({
  event: Joi.string().required(),
  data: Joi.object({
    status: Joi.string().required(),
    reference: Joi.string().optional(),
    amount: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
    fee: Joi.alternatives().try(Joi.number(), Joi.string()).optional(),
    currency: Joi.string().required(),
    payment_method: Joi.string().optional(),
    payment_reference: Joi.string().allow(null).optional(),
    metadata: Joi.object().allow(null).optional(),
  })
    .or("reference", "payment_reference")
    .required()
    .unknown(true),
}).unknown(true);
