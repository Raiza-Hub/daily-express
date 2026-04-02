import Joi from "joi";

// Helper for phone number regex (basic international format)
const phoneRegex = /^\+?[1-9]\d{1,14}$/;

export const createDriverSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).required().messages({
    "string.empty": "First name is required",
    "string.min": "First name must be at least 1 character long",
    "string.max": "First name must not exceed 50 characters",
  }),
  lastName: Joi.string().min(1).max(50).required().messages({
    "string.empty": "Last name is required",
    "string.min": "Last name must be at least 1 character long",
    "string.max": "Last name must not exceed 50 characters",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Please provide a valid email address",
    "string.empty": "Email is required",
  }),
  //can be nulll
  profile_pic: Joi.string().optional(),
  phone: Joi.string().regex(phoneRegex).required().messages({
    "string.pattern.base": "Phone number must be a valid international format",
    "string.empty": "Phone number is required",
  }),
  // gender: Joi.string().valid("male", "female", "other").required().messages({
  //   "any.only": "Gender must be either male, female, or other",
  //   "string.empty": "Gender is required",
  // }),
  country: Joi.string().min(2).max(100).required().messages({
    "string.empty": "Country is required",
  }),
  state: Joi.string().min(2).max(100).required().messages({
    "string.empty": "State is required",
  }),
  city: Joi.string().min(2).max(100).required().messages({
    "string.empty": "City is required",
  }),
  address: Joi.string().min(1).max(200).required().messages({
    "string.empty": "Address is required",
  }),
  bankName: Joi.string().min(2).max(100).required().messages({
    "string.empty": "Bank name is required",
  }),
  accountNumber: Joi.string().min(2).max(100).required().messages({
    "string.empty": "Account number is required",
  }),
  accountName: Joi.string().min(2).max(100).required().messages({
    "string.empty": "Account name is required",
  }),
});

export const updateDriverSchema = Joi.object({
  firstName: Joi.string().min(1).max(50).optional().messages({
    "string.min": "First name must be at least 1 character long",
    "string.max": "First name must not exceed 50 characters",
  }),
  lastName: Joi.string().min(1).max(50).optional().messages({
    "string.min": "Last name must be at least 1 character long",
    "string.max": "Last name must not exceed 50 characters",
  }),
  email: Joi.string().email().optional().messages({
    "string.email": "Please provide a valid email address",
  }),
  password: Joi.string().min(8).optional().messages({
    "string.min": "Password must be at least 8 characters long",
  }),
  phone: Joi.string().regex(phoneRegex).optional().messages({
    "string.pattern.base": "Phone number must be a valid international format",
  }),
  // gender: Joi.string().valid("male", "female", "other").optional(),
  country: Joi.string().min(2).max(100).optional(),
  state: Joi.string().min(2).max(100).optional(),
  city: Joi.string().min(2).max(100).optional(),
  address: Joi.string().min(1).max(200).optional(),
  bankName: Joi.string().min(2).max(100).optional(),
  accountNumber: Joi.string().min(2).max(100).optional(),
  accountName: Joi.string().min(2).max(100).optional(),
}).min(1); // Ensures at least one field is provided for an update
