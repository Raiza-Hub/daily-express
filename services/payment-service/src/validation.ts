import Joi from "joi";
import { KORA_CHECKOUT_CHANNELS } from "@shared/types";

const koraChannelSchema = Joi.string().valid(...KORA_CHECKOUT_CHANNELS);
const metadataValueSchema = Joi.alternatives().try(
  Joi.string().max(255),
  Joi.number(),
  Joi.boolean(),
);

export const initializePaymentSchema = Joi.object({
  bookingId: Joi.string().uuid().required(),
  reference: Joi.string().max(128).optional(),
  currency: Joi.string().uppercase().length(3).default("NGN"),
  channels: Joi.array().items(koraChannelSchema).optional(),
  productName: Joi.string().min(2).max(120).required(),
  productDescription: Joi.string().min(2).max(500).required(),
  customerName: Joi.string().max(120).optional(),
  customerMobile: Joi.string().max(32).optional(),
  metadata: Joi.object()
    .pattern(/^[A-Za-z0-9-]{1,20}$/, metadataValueSchema)
    .min(1)
    .max(5)
    .optional(),
});

export const upsertBookingHoldSchema = Joi.object({
  bookingId: Joi.string().uuid().required(),
  tripId: Joi.string().uuid().required(),
  userId: Joi.string().uuid().required(),
  fareAmount: Joi.number().integer().min(0).required(),
  currency: Joi.string().uppercase().length(3).default("NGN"),
  expiresAt: Joi.date().iso().required(),
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
