import Joi from "joi";

const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;

const timeArray = (label: string) =>
  Joi.array()
    .items(Joi.string().pattern(timePattern))
    .min(1)
    .required()
    .messages({
      "array.min": `${label} must include at least one time`,
      "string.pattern.base": `${label} times must be in HH:MM or HH:MM:SS format`,
      "any.required": `${label} is required`,
    });

export const createRouteSchema = Joi.object({
  origin_title: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Origin title is required",
      "string.min": "Origin title must be at least 2 characters long",
      "string.max": "Origin title must not exceed 255 characters",
      "any.required": "Origin title is required",
    })
    .required(),
  origin_locality: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Origin locality is required",
      "any.required": "Origin locality is required",
    })
    .required(),
  origin_label: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Origin label is required",
      "any.required": "Origin label is required",
    })
    .required(),
  destination_title: Joi.string().min(2).max(255).allow(null, "").optional(),
  destination_locality: Joi.string().min(2).max(255).allow(null, "").optional(),
  destination_label: Joi.string().min(2).max(255).allow(null, "").optional(),
  train_station_title: Joi.string().min(2).max(255).allow(null, "").optional(),
  train_station_locality: Joi.string().min(2).max(255).allow(null, "").optional(),
  train_station_label: Joi.string().min(2).max(255).allow(null, "").optional(),
  pickup_point: Joi.string().min(2).max(500).required().messages({
    "string.empty": "Pickup point is required",
    "string.min": "Pickup point must be at least 2 characters long",
    "string.max": "Pickup point must not exceed 500 characters",
    "any.required": "Pickup point is required",
  }),
  dropoff_point: Joi.string().min(2).max(500).required().messages({
    "string.empty": "Dropoff point is required",
    "string.min": "Dropoff point must be at least 2 characters long",
    "string.max": "Dropoff point must not exceed 500 characters",
    "any.required": "Dropoff point is required",
  }),
  price: Joi.number().integer().min(0).required().messages({
    "number.base": "Price must be a number",
    "number.integer": "Price must be a whole number",
    "number.min": "Price cannot be negative",
    "any.required": "Price is required",
  }),
  fee: Joi.number().integer().min(0).allow(null).optional().messages({
    "number.base": "Fee must be a number",
    "number.integer": "Fee must be a whole number",
    "number.min": "Fee cannot be negative",
  }),
  luggage_fee: Joi.number().integer().min(0).required().messages({
    "number.base": "Luggage fee must be a number",
    "number.integer": "Luggage fee must be a whole number",
    "number.min": "Luggage fee cannot be negative",
    "any.required": "Luggage fee is required",
  }),
  departure_time: timeArray("Departure"),
  arrival_time: timeArray("Arrival"),
  status: Joi.string()
    .valid("inactive", "pending", "active")
    .optional()
    .messages({
      "any.only": "Status must be one of: inactive, pending, active",
    }),
});

export const updateRouteSchema = Joi.object({
  origin_title: Joi.string().min(2).max(255).optional().allow(null),
  origin_locality: Joi.string().min(2).max(255).optional().allow(null),
  origin_label: Joi.string().min(2).max(255).optional().allow(null),
  destination_title: Joi.string().min(2).max(255).optional().allow(null),
  destination_locality: Joi.string().min(2).max(255).optional().allow(null),
  destination_label: Joi.string().min(2).max(255).optional().allow(null),
  train_station_title: Joi.string().min(2).max(255).optional().allow(null),
  train_station_locality: Joi.string().min(2).max(255).optional().allow(null),
  train_station_label: Joi.string().min(2).max(255).optional().allow(null),
  pickup_point: Joi.string().min(2).max(500).optional(),
  dropoff_point: Joi.string().min(2).max(500).optional(),
  price: Joi.number().integer().min(0).optional(),
  fee: Joi.number().integer().min(0).allow(null).optional(),
  luggage_fee: Joi.number().integer().min(0).optional(),
  departure_time: Joi.array()
    .items(Joi.string().pattern(timePattern))
    .min(1)
    .optional(),
  arrival_time: Joi.array()
    .items(Joi.string().pattern(timePattern))
    .min(1)
    .optional(),
  status: Joi.string().valid("inactive", "pending", "active").optional(),
}).min(1);