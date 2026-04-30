import Joi from "joi";

export const resolveBankAccountSchema = Joi.object({
  bankCode: Joi.string().min(3).max(20).required(),
  accountNumber: Joi.string().min(10).max(20).required(),
  currency: Joi.string().min(3).max(3).required(),
});

export const koraWebhookSchema = Joi.object({
  event: Joi.string().required(),
  data: Joi.object({
    reference: Joi.string().required(),
    status: Joi.string().required(),
    amount: Joi.number().required(),
    fee: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
    currency: Joi.string().required(),
    message: Joi.string().optional(),
  })
    .required()
    .unknown(true),
}).unknown(true);
