import Joi from "joi";

export const createRouteSchema = Joi.object({
  pickup_location_title: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Pickup location title is required",
      "string.min": "Pickup location title must be at least 2 characters long",
      "string.max": "Pickup location title must not exceed 255 characters",
      "any.required": "Pickup location title is required",
    })
    .required(),
  pickup_location_locality: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Pickup location locality is required",
      "any.required": "Pickup location locality is required",
    })
    .required(),
  pickup_location_label: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Pickup location label is required",
      "any.required": "Pickup location label is required",
    })
    .required(),
  dropoff_location_title: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Dropoff location title is required",
      "string.min": "Dropoff location title must be at least 2 characters long",
      "string.max": "Dropoff location title must not exceed 255 characters",
      "any.required": "Dropoff location title is required",
    })
    .required(),
  dropoff_location_locality: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Dropoff location locality is required",
      "any.required": "Dropoff location locality is required",
    })
    .required(),
  dropoff_location_label: Joi.string()
    .min(2)
    .max(255)
    .messages({
      "string.empty": "Dropoff location label is required",
      "any.required": "Dropoff location label is required",
    })
    .required(),
  intermediate_stops_title: Joi.string().max(500).allow(null, "").optional(),
  intermediate_stops_locality: Joi.string().max(500).allow(null, "").optional(),
  intermediate_stops_label: Joi.string().max(500).allow(null, "").optional(),
  meeting_point: Joi.string().min(2).max(500).required().messages({
    "string.empty": "Meeting point is required",
    "string.min": "Meeting point must be at least 2 characters long",
    "string.max": "Meeting point must not exceed 500 characters",
    "any.required": "Meeting point is required",
  }),
  priceCar: Joi.number().integer().min(0).required().messages({
    "number.base": "Car price must be a number",
    "number.integer": "Car price must be a whole number",
    "number.min": "Car price cannot be negative",
    "any.required": "Car price is required",
  }),
  priceBus: Joi.number().integer().min(0).required().messages({
    "number.base": "Bus price must be a number",
    "number.integer": "Bus price must be a whole number",
    "number.min": "Bus price cannot be negative",
    "any.required": "Bus price is required",
  }),
  fee: Joi.number().integer().min(0).allow(null).optional().messages({
    "number.base": "Fee must be a number",
    "number.integer": "Fee must be a whole number",
    "number.min": "Fee cannot be negative",
  }),
  departure_time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .required()
    .messages({
      "string.pattern.base":
        "Departure time must be in HH:MM or HH:MM:SS format",
      "any.required": "Departure time is required",
    }),
  arrival_time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .required()
    .messages({
      "string.pattern.base":
        "Arrival time must be in HH:MM or HH:MM:SS format",
      "any.required": "Arrival time is required",
    }),
  status: Joi.string()
    .valid("inactive", "pending", "active")
    .optional()
    .messages({
      "any.only": "Status must be one of: inactive, pending, active",
    }),
});

export const updateRouteSchema = Joi.object({
  pickup_location_title: Joi.string().min(2).max(255).optional().allow(null),
  pickup_location_locality: Joi.string().min(2).max(255).optional().allow(null),
  pickup_location_label: Joi.string().min(2).max(255).optional().allow(null),
  dropoff_location_title: Joi.string().min(2).max(255).optional().allow(null),
  dropoff_location_locality: Joi.string().min(2).max(255).optional().allow(null),
  dropoff_location_label: Joi.string().min(2).max(255).optional().allow(null),
  intermediate_stops_title: Joi.string().max(500).allow(null, "").optional(),
  intermediate_stops_locality: Joi.string().max(500).allow(null, "").optional(),
  intermediate_stops_label: Joi.string().max(500).allow(null, "").optional(),
  meeting_point: Joi.string().min(2).max(500).optional(),
  priceCar: Joi.number().integer().min(0).optional(),
  priceBus: Joi.number().integer().min(0).optional(),
  fee: Joi.number().integer().min(0).allow(null).optional(),
  departure_time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
  arrival_time: Joi.string()
    .pattern(/^\d{2}:\d{2}(:\d{2})?$/)
    .optional(),
  status: Joi.string().valid("inactive", "pending", "active").optional(),
}).min(1);
