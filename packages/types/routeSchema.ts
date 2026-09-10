import { z } from "zod/v4";

const locationSchema = z.object({
  title: z.string().min(1, { error: "Location title is required" }),
  locality: z.string().min(1, { error: "Location locality is required" }),
  label: z.string().min(1, { error: "Location label is required" }),
});

const nullableLocationSchema = locationSchema.nullable().optional();

export const routeSchema = z.object({
  origin: locationSchema,
  destination: nullableLocationSchema,
  train_station: nullableLocationSchema,
  pickupPoint: z
    .string()
    .min(2, { error: "Pickup point is required" })
    .max(500, { error: "Pickup point is too long" }),
  dropoffPoint: z
    .string()
    .min(2, { error: "Dropoff point is required" })
    .max(500, { error: "Dropoff point is too long" }),
  vehicleType: z.enum(["car", "bus"]),
  departureTime: z.date({ error: "Departure time is required" }),
  estimatedArrivalTime: z.date({ error: "Arrival time is required" }),
  boardingPoint: z.enum(["pickup", "dropoff"]),
  price: z.number({ error: "Price is required" }),
  fee: z.number().nullable().optional(),
  luggageFee: z.number({ error: "Luggage fee is required" }),
}).refine(
  data => data.estimatedArrivalTime > data.departureTime,
  {
    error: "Arrival time must be after departure time",
    path: ['estimatedArrivalTime'],
  }
);

export type TRoute = z.infer<typeof routeSchema>;