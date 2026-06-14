import Joi from "joi";

export function isUnder13(dateOfBirth: Date): boolean {
  const today = new Date();
  const threshold = new Date(
    today.getFullYear() - 13,
    today.getMonth(),
    today.getDate(),
  );
  return dateOfBirth > threshold;
}

export const registerSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  firstName: Joi.string().required().messages({
    "any.required": "First name is required",
  }),
  lastName: Joi.string().required().messages({
    "any.required": "Last name is required",
  }),
  dateOfBirth: Joi.date()
    .required()
    .custom((value, helpers) => {
      if (isUnder13(value)) {
        return helpers.error("dateOfBirth.under13");
      }
      return value;
    })
    .messages({
      "any.required": "Date of birth is required",
      "dateOfBirth.under13":
        "You must be at least 13 years old to create an account",
    }),
  password: Joi.string()
    .min(8)
    // Removed the restrictive character set at the end to allow ALL special chars
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      "any.required": "Password is required",
    }),
  referral: Joi.string().optional().allow(null),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});


export const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  dateOfBirth: Joi.date()
    .optional()
    .custom((value, helpers) => {
      if (isUnder13(value)) {
        return helpers.error("dateOfBirth.under13");
      }
      return value;
    })
    .messages({
      "dateOfBirth.under13":
        "You must be at least 13 years old to create an account",
    }),
});


export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
});

export const resetPasswordSchema = Joi.object({
    password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      "any.required": "Password is required",
    }),
});

export const setPasswordSchema = Joi.object({
    password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters long",
      "string.pattern.base":
        "Password must contain at least one uppercase letter, one lowercase letter, and one number",
      "any.required": "Password is required",
    }),
});
