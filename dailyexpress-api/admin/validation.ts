import z from "zod";

export const createOriginSchema = z.object({
  title: z
    .string({ error: "Origin title is required" })
    .min(2, "Origin title must be at least 2 characters long")
    .max(255, "Origin title must not exceed 255 characters"),
  locality: z
    .string({ error: "Origin locality is required" })
    .min(2, "Origin locality must be at least 2 characters long")
    .max(255, "Origin locality must not exceed 255 characters"),
  meetingPoint: z
    .string({ error: "Meeting point is required" })
    .min(2, "Meeting point must be at least 2 characters long")
    .max(500, "Meeting point must not exceed 500 characters"),
  departureTime: z
    .array(z.iso.time("Departure times must be in HH:MM or HH:MM:SS format"), {
      error: "Departure is required",
    })
    .min(1, "Departure must include at least one time"),
  price: z.coerce
    .number("Price must be a number")
    .int("Price must be a whole number")
    .min(0, "Price cannot be negative"),
  fee: z.coerce
    .number("Fee must be a number")
    .int("Fee must be a whole number")
    .min(0, "Fee cannot be negative"),
  luggageFee: z.coerce
    .number("Luggage fee must be a number")
    .int("Luggage fee must be a whole number")
    .min(0, "Luggage fee cannot be negative"),
  destinationIds: z
    .array(z.uuid(), "Destinations must be an array of valid IDs")
    .min(1, "Destinations must include at least one destination"),
  status: z
    .enum(["inactive", "pending", "active"], {
      error: "Status must be one of: inactive, pending, active",
    }),
});

export const updateOriginSchema = z
  .object({
    title: z
      .string()
      .min(2, "Origin title must be at least 2 characters long")
      .max(255, "Origin title must not exceed 255 characters")
      .optional(),
    locality: z
      .string()
      .min(2, "Origin locality must be at least 2 characters long")
      .max(255, "Origin locality must not exceed 255 characters")
      .optional(),
    meetingPoint: z
      .string()
      .min(2, "Meeting point must be at least 2 characters long")
      .max(500, "Meeting point must not exceed 500 characters")
      .optional(),
    departureTime: z
      .array(z.iso.time("Departure times must be in HH:MM or HH:MM:SS format"))
      .min(1, "Departure must include at least one time")
      .optional(),
    price: z.coerce
      .number("Price must be a number")
      .int("Price must be a whole number")
      .min(0, "Price cannot be negative")
      .optional(),
    fee: z.coerce
      .number("Fee must be a number")
      .int("Fee must be a whole number")
      .min(0, "Fee cannot be negative")
      .optional(),
    luggageFee: z.coerce
      .number("Luggage fee must be a number")
      .int("Luggage fee must be a whole number")
      .min(0, "Luggage fee cannot be negative")
      .optional(),
    destinationIds: z
      .array(z.uuid(), "Destinations must be an array of valid IDs")
      .min(1, "Destinations must include at least one destination")
      .optional(),
    status: z
      .enum(["inactive", "pending", "active"], {
        error: "Status must be one of: inactive, pending, active",
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length >= 1, {
    message: "must contain at least 1 keys",
    path: ["request"],
  });

export const createDestinationSchema = z.object({
  title: z
    .string({ error: "Destination title is required" })
    .min(2, "Destination title must be at least 2 characters long")
    .max(255, "Destination title must not exceed 255 characters"),
  locality: z
    .string({ error: "Destination locality is required" })
    .min(2, "Destination locality must be at least 2 characters long")
    .max(255, "Destination locality must not exceed 255 characters"),
});

export const updateDestinationSchema = z
  .object({
    title: z
      .string()
      .min(2, "Destination title must be at least 2 characters long")
      .max(255, "Destination title must not exceed 255 characters")
      .optional(),
    locality: z
      .string()
      .min(2, "Destination locality must be at least 2 characters long")
      .max(255, "Destination locality must not exceed 255 characters")
      .optional(),
    status: z
      .enum(["inactive", "pending", "active"], {
        error: "Status must be one of: inactive, pending, active",
      })
      .optional(),
  })
  .refine((value) => Object.keys(value).length >= 1, {
    message: "must contain at least 1 keys",
    path: ["request"],
  });