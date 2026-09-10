import Joi from "joi";

export const MINIMUM_ACCOUNT_AGE = 14;

export const ONBOARDING_PHONE_REGEX = /^\+234[789]\d{9}$/;
export const ONBOARDING_GENDERS = ["male", "female"] as const;

export function isUnder14(dateOfBirth: Date): boolean {
  const today = new Date();
  const threshold = new Date(
    today.getFullYear() - MINIMUM_ACCOUNT_AGE,
    today.getMonth(),
    today.getDate(),
  );
  return dateOfBirth > threshold;
}

export const completeOnboardingSchema = Joi.object({
  phoneNumber: Joi.string()
    .pattern(ONBOARDING_PHONE_REGEX)
    .required()
    .messages({
      "string.pattern.base":
        "Enter a valid Nigerian phone number in international format (e.g. +2348012345678)",
      "any.required": "Phone number is required",
    }),
  dateOfBirth: Joi.date()
    .required()
    .custom((value, helpers) => {
      if (isUnder14(value)) {
        return helpers.error("dateOfBirth.under14");
      }
      return value;
    })
    .messages({
      "any.required": "Date of birth is required",
      "dateOfBirth.under14": `You must be at least ${MINIMUM_ACCOUNT_AGE} years old`,
    }),
  gender: Joi.string()
    .valid(...ONBOARDING_GENDERS)
    .required()
    .messages({
      "any.only": "Please select your gender",
      "any.required": "Gender is required",
    }),
});

export const updateProfileSchema = Joi.object({
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  dateOfBirth: Joi.date()
    .optional()
    .custom((value, helpers) => {
      if (isUnder14(value)) {
        return helpers.error("dateOfBirth.under14");
      }
      return value;
    })
    .messages({
      "dateOfBirth.under14": `You must be at least ${MINIMUM_ACCOUNT_AGE} years old`,
    }),
  phoneNumber: Joi.string()
    .pattern(ONBOARDING_PHONE_REGEX)
    .optional()
    .messages({
      "string.pattern.base":
        "Enter a valid Nigerian phone number in international format (e.g. +2348012345678)",
    }),
  gender: Joi.string()
    .valid(...ONBOARDING_GENDERS)
    .optional()
    .messages({
      "any.only": "Please select your gender",
    }),
});