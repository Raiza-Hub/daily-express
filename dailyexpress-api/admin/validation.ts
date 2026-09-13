import z from "zod/v4";

const timePattern = /^\d{2}:\d{2}(:\d{2})?$/;

const requiredString = (field: string, min: number, max: number) =>
  z
    .string({ error: `${field} is required` })
    .min(min, {
      error: (issue) =>
        typeof issue.input === "string" && issue.input.length === 0
          ? `${field} is required`
          : `${field} must be at least ${min} characters long`,
    })
    .max(max, `${field} must not exceed ${max} characters`);

const moneyNumber = (label: string) =>
  z
    .coerce.number({ error: `${label} must be a number` })
    .int(`${label} must be a whole number`)
    .min(0, `${label} cannot be negative`);

const timeArray = (label: string) =>
  z
    .array(
      z.string().regex(timePattern, `${label} times must be in HH:MM or HH:MM:SS format`),
      { error: `${label} is required` },
    )
    .min(1, `${label} must include at least one time`);

const nullableString = (min: number, max: number) =>
  z.union([z.string().min(min).max(max), z.null()]).optional();

const nullableOrEmptyString = (min: number, max: number) =>
  z
    .union([z.string().min(min).max(max), z.literal(""), z.null()])
    .optional();

const atLeastOneField = (value: object) =>
  Object.keys(value).length >= 1;

export const createRouteSchema = z
  .object({
    origin_title: requiredString("Origin title", 2, 255),
    origin_locality: requiredString("Origin locality", 2, 255),
    origin_label: requiredString("Origin label", 2, 255),
    destination_title: nullableOrEmptyString(2, 255),
    destination_locality: nullableOrEmptyString(2, 255),
    destination_label: nullableOrEmptyString(2, 255),
    train_station_title: nullableOrEmptyString(2, 255),
    train_station_locality: nullableOrEmptyString(2, 255),
    train_station_label: nullableOrEmptyString(2, 255),
    pickup_point: requiredString("Pickup point", 2, 500),
    dropoff_point: requiredString("Dropoff point", 2, 500),
    price: moneyNumber("Price").optional(),
    fee: moneyNumber("Fee").nullable().optional(),
    luggage_fee: moneyNumber("Luggage fee").optional(),
    departure_time: timeArray("Departure"),
    arrival_time: timeArray("Arrival"),
    status: z
      .enum(["inactive", "pending", "active"], {
        error: "Status must be one of: inactive, pending, active",
      })
      .optional(),
  })
  .superRefine((value, ctx) => {
    if (value.price === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["price"],
        message: "Price is required",
      });
    }
    if (value.luggage_fee === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["luggage_fee"],
        message: "Luggage fee is required",
      });
    }
  });

export const updateRouteSchema = z
  .object({
    origin_title: nullableString(2, 255),
    origin_locality: nullableString(2, 255),
    origin_label: nullableString(2, 255),
    destination_title: nullableString(2, 255),
    destination_locality: nullableString(2, 255),
    destination_label: nullableString(2, 255),
    train_station_title: nullableString(2, 255),
    train_station_locality: nullableString(2, 255),
    train_station_label: nullableString(2, 255),
    pickup_point: z.string().min(2).max(500).optional(),
    dropoff_point: z.string().min(2).max(500).optional(),
    price: moneyNumber("Price").optional(),
    fee: moneyNumber("Fee").nullable().optional(),
    luggage_fee: moneyNumber("Luggage fee").optional(),
    departure_time: z
      .array(z.string().regex(timePattern, "Departure times must be in HH:MM or HH:MM:SS format"))
      .min(1, "Departure must include at least one time")
      .optional(),
    arrival_time: z
      .array(z.string().regex(timePattern, "Arrival times must be in HH:MM or HH:MM:SS format"))
      .min(1, "Arrival must include at least one time")
      .optional(),
    status: z
      .enum(["inactive", "pending", "active"], {
        error: "Status must be one of: inactive, pending, active",
      })
      .optional(),
  })
  .refine(atLeastOneField, {
    message: "must contain at least 1 keys",
    path: ["request"],
  });