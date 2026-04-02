import Joi from "joi";

const paystackChannelSchema = Joi.string().valid(
  "card",
  "bank",
  "apple_pay",
  "ussd",
  "qr",
  "mobile_money",
  "bank_transfer",
  "eft",
  "capitec_pay",
  "payattitude",
);

export const initializePaymentSchema = Joi.object({
  bookingId: Joi.string().uuid().optional(),
  reference: Joi.string().max(128).optional(),
  amountMinor: Joi.number().integer().min(100).required(),
  currency: Joi.string().uppercase().length(3).default("NGN"),
  channels: Joi.array().items(paystackChannelSchema).optional(),
  productName: Joi.string().min(2).max(120).required(),
  productDescription: Joi.string().min(2).max(500).required(),
  redirectUrl: Joi.string().uri().optional(),
  cancelUrl: Joi.string().uri().optional(),
  customerName: Joi.string().max(120).optional(),
  customerMobile: Joi.string().max(32).optional(),
  metadata: Joi.object().unknown(true).optional(),
});

export const paystackWebhookSchema = Joi.object({
  event: Joi.string().required(),
  data: Joi.object({
    id: Joi.number().integer().required(),
    status: Joi.string().required(),
    reference: Joi.string().required(),
    amount: Joi.number().integer().required(),
    currency: Joi.string().required(),
    gateway_response: Joi.string().optional(),
    channel: Joi.string().optional(),
    paid_at: Joi.string().allow(null).optional(),
    metadata: Joi.object().allow(null).optional(),
  })
    .required()
    .unknown(true),
}).unknown(true);
