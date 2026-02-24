import { z } from "zod";

const locationSchema = z.object({
  title: z.string().min(1, { error: "Location title is required" }),
  locality: z.string().min(1, { error: "Location locality is required" }),
  label: z.string().min(1, { error: "Location label is required" }),
});

export const routeSchema = z.object({
  departureCity: locationSchema,
  arrivalCity: locationSchema,
  vehicleType: z
    .string()
    .min(1, { error: "Vehicle type is required" }),
  seatNumber: z
    .number()
    .min(1, { error: "Seat number must be greater than 0" }),
  price: z
    .number()
    .min(0, { error: "Price must be greater than or equal to 0" }),
  departureTime: z
    .date({ error: "Departure time is required" }),
  estimatedArrivalTime: z
    .date({ error: "Arrival time is required" }),
  meetingPoint: z
    .string()
    .min(5, { error: "Meeting point is required" })
    .max(200, { error: "Meeting point is too long" }),
}).refine(
  data => data.estimatedArrivalTime > data.departureTime,
  {
    error: "Arrival time must be after departure time",
    path: ['estimatedArrivalTime'],
  }
);

export type TRoute = z.infer<typeof routeSchema>;
