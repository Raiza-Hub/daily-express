"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  useCreateVehicle,
  useUpdateVehicle,
} from "@repo/api";
import { vehicleFormSchema, type TVehicleFormValues } from "@repo/types";
import type { Vehicle } from "@shared/types";
import { ResponsiveModal } from "@repo/ui/ResponsiveModal";
import { Button } from "@repo/ui/components/button";
import {
  Field,
  FieldError,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { posthogEvents } from "~/lib/posthog-events";

interface VehicleFormDialogProps {
  vehicle?: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function VehicleFormDialog({
  vehicle,
  open,
  onOpenChange,
}: VehicleFormDialogProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const posthog = usePostHog();
  const isEdit = !!vehicle;

  const {
    control,
    handleSubmit,
    setError,
    reset,
  } = useForm<TVehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      plateNumber: vehicle?.plateNumber ?? "",
      make: vehicle?.make ?? "",
      model: vehicle?.model ?? "",
      capacity: vehicle?.capacity ?? 1,
      color: vehicle?.color ?? "",
    },
  });

  const { mutate: createVehicle, isPending: isCreating } = useCreateVehicle({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_vehicle_created_succeeded);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      applyApiFieldErrors<keyof TVehicleFormValues>(error, setError);
      posthog.captureException(error, {
        action: "create_vehicle_failed",
      });
      setFormError(getApiErrorMessage(error, "Failed to create vehicle"));
    },
  });

  const { mutate: updateVehicle, isPending: isUpdating } = useUpdateVehicle({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_vehicle_updated_succeeded);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      applyApiFieldErrors<keyof TVehicleFormValues>(error, setError);
      posthog.captureException(error, {
        action: "update_vehicle_failed",
      });
      setFormError(getApiErrorMessage(error, "Failed to update vehicle"));
    },
  });

  const isPending = isCreating || isUpdating;

  const closeModal = () => {
    reset();
    setFormError(null);
    onOpenChange(false);
  };

  const onSubmit = (data: TVehicleFormValues) => {
    if (isEdit && vehicle) {
      updateVehicle({ id: vehicle.id, data });
    } else {
      createVehicle(data);
    }
  };

  return (
      <ResponsiveModal
      key={`${vehicle?.id ?? "new"}-${open}`}
      open={open}
      onOpenChange={(val) => {
        if (!val) closeModal();
      }}
      title={isEdit ? "Edit Vehicle" : "Add Vehicle"}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6 py-4 px-4 sm:p-0"
      >
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Controller
              name="plateNumber"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="plateNumber">Plate Number</FieldLabel>
                  <Input
                    {...field}
                    id="plateNumber"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g., ABC-1234"
                    autoComplete="off"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Controller
                name="make"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="make">Make</FieldLabel>
                    <Input
                      {...field}
                      id="make"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g., Toyota"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Controller
                name="model"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="model">Model</FieldLabel>
                    <Input
                      {...field}
                      id="model"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g., Camry"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Controller
                name="color"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="color">Color</FieldLabel>
                    <Input
                      {...field}
                      id="color"
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g., White"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-2">
              <Controller
                name="capacity"
                control={control}
                render={({ field: { onChange, ...field }, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="capacity">Capacity (seats)</FieldLabel>
                    <Input
                      {...field}
                      id="capacity"
                      type="number"
                      min={1}
                      onChange={(e) => {
                          const val = e.target.value;
                          onChange(val === "" ? "" : Number(val));
                      }}
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g., 4"
                      autoComplete="off"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </div>
        </div>

        {formError && (
          <p className="px-1 pb-2 inline-flex justify-center text-sm text-red-500">
            {formError}
          </p>
        )}

        <div className="px-4 pb-4 pt-2 flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            className="cursor-pointer"
            onClick={closeModal}
          >
            Cancel
          </Button>
          <Button type="submit" variant="submit" disabled={isPending}>
            {isEdit ? "Save Changes" : "Add Vehicle"}
          </Button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
