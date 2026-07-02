import { z } from "zod/v4";

export const vehicleFormSchema = z.object({
  plateNumber: z.string().min(1, { error: "Plate number is required" }),
  make: z.string().min(1, { error: "Make is required" }),
  model: z.string().min(1, { error: "Model is required" }),
  capacity: z.number({ error: "Capacity is required" }).int().min(1, { error: "Capacity must be at least 1" }),
  color: z.string().min(1, { error: "Color is required" }),
});

export type TVehicleFormValues = z.infer<typeof vehicleFormSchema>;
