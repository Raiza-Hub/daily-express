import Joi from "joi";

export const createRouteSchema = Joi.object({
  pickup_location_title: Joi.string().min(2).max(255).required().messages({
    "string.empty": "Pickup location title is required",
    "string.min": "Pickup location title must be at least 2 characters long",
    "string.max": "Pickup location title must not exceed 255 characters",
    "any.required": "Pickup location title is required",
  }),
  pickup_location_locality: Joi.string().min(2).max(255).required().messages({
    "string.empty": "Pickup location locality is required",
    "any.required": "Pickup location locality is required",
  }),
  pickup_location_label: Joi.string().min(2).max(255).required().messages({
    "string.empty": "Pickup location label is required",
    "any.required": "Pickup location label is required",
  }),

  dropoff_location_title: Joi.string().min(2).max(255).required().messages({
    "string.empty": "Dropoff location title is required",
    "string.min": "Dropoff location title must be at least 2 characters long",
    "string.max": "Dropoff location title must not exceed 255 characters",
    "any.required": "Dropoff location title is required",
  }),
  dropoff_location_locality: Joi.string().min(2).max(255).required().messages({
    "string.empty": "Dropoff location locality is required",
    "any.required": "Dropoff location locality is required",
  }),
  dropoff_location_label: Joi.string().min(2).max(255).required().messages({
    "string.empty": "Dropoff location label is required",
    "any.required": "Dropoff location label is required",
  }),

  intermediate_stops_title: Joi.string().max(500).allow(null, "").optional(),
  intermediate_stops_locality: Joi.string().max(500).allow(null, "").optional(),
  intermediate_stops_label: Joi.string().max(500).allow(null, "").optional(),

  vehicleType: Joi.string()
    .valid("car", "bus", "luxury_car")
    .required()
    .messages({
      "any.only": "Vehicle type must be one of: car, bus, luxury_car",
      "string.empty": "Vehicle type is required",
      "any.required": "Vehicle type is required",
    }),

  meeting_point: Joi.string().min(2).max(500).required().messages({
    "string.empty": "Meeting point is required",
    "string.min": "Meeting point must be at least 2 characters long",
    "string.max": "Meeting point must not exceed 500 characters",
    "any.required": "Meeting point is required",
  }),

  availableSeats: Joi.number().integer().min(1).required().messages({
    "number.base": "Available seats must be a number",
    "number.integer": "Available seats must be a whole number",
    "number.min": "Available seats must be at least 1",
    "any.required": "Available seats is required",
  }),

  price: Joi.number().integer().min(0).required().messages({
    "number.base": "Price must be a number",
    "number.integer": "Price must be a whole number",
    "number.min": "Price cannot be negative",
    "any.required": "Price is required",
  }),

  // --- NEW FIELDS START ---
  departure_time: Joi.date().iso().required().messages({
    "date.base": "Departure time must be a valid date",
    "date.format":
      "Departure time must be in ISO format (YYYY-MM-DDTHH:mm:ss.sssZ)",
    "any.required": "Departure time is required",
  }),

  arrival_time: Joi.date()
    .iso()
    .greater(Joi.ref("departure_time"))
    .required()
    .messages({
      "date.base": "Arrival time must be a valid date",
      "date.greater": "Arrival time must be after the departure time",
      "any.required": "Arrival time is required",
    }),
  // --- NEW FIELDS END ---

  status: Joi.string()
    .valid("inactive", "pending", "active")
    .optional()
    .messages({
      "any.only": "Status must be one of: inactive, pending, active",
    }),
});

export const updateRouteSchema = Joi.object({
  pickup_location_title: Joi.string().min(2).max(255).optional(),
  pickup_location_locality: Joi.string().min(2).max(255).optional(),
  pickup_location_label: Joi.string().min(2).max(255).optional(),
  dropoff_location_title: Joi.string().min(2).max(255).optional(),
  dropoff_location_locality: Joi.string().min(2).max(255).optional(),
  dropoff_location_label: Joi.string().min(2).max(255).optional(),
  intermediate_stops_title: Joi.string().max(500).allow(null, "").optional(),
  intermediate_stops_locality: Joi.string().max(500).allow(null, "").optional(),
  intermediate_stops_label: Joi.string().max(500).allow(null, "").optional(),
  vehicleType: Joi.string().valid("car", "bus", "luxury_car").optional(),
  meeting_point: Joi.string().min(2).max(500).optional(),
  availableSeats: Joi.number().integer().min(1).optional(),
  price: Joi.number().integer().min(0).optional(),

  // Update fields
  departure_time: Joi.date().iso().optional(),
  arrival_time: Joi.date().iso().optional(),

  status: Joi.string().valid("inactive", "pending", "active").optional(),
}).min(1);

export const createTripSchema = Joi.object({
  routeId: Joi.string().uuid().required().messages({
    "string.empty": "Route ID is required",
    "string.guid": "Route ID must be a valid UUID",
    "any.required": "Route ID is required",
  }),
  date: Joi.date().iso().required().messages({
    "date.base": "Date must be a valid date",
    "date.format": "Date must be in ISO format",
    "any.required": "Date is required",
  }),
});

export const updateTripSchema = Joi.object({
  routeId: Joi.string().uuid().optional(),
  date: Joi.date().iso().optional(),
}).min(1);
