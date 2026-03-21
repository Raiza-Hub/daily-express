import Joi from "joi";

export const sendMailSchema = Joi.object({
  to: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Recipient email (to) is required",
  }),
  subject: Joi.string().required().messages({
    "any.required": "Subject is required",
  }),
  html: Joi.string().required().messages({
    "any.required": "HTML content is required",
  }),
});
