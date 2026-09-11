"use client";

import { UserPlus, X } from "@phosphor-icons/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod/v4";
import { Button as UiButton } from "@repo/ui/components/button";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Field, FieldError } from "@repo/ui/components/field";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@repo/ui/components/drawer";
import { Avatar, AvatarFallback } from "@repo/ui/components/avatar";

export interface Passenger {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  carriesLuggage: boolean;
}

const MAX_PASSENGERS = 4;

const PassengerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, { error: "Enter the passenger's full name." }),
  email: z.email({ error: "Enter a valid email address." }),
  phone: z.string().regex(/^234\d{10}$/, {
    error: "Use the 234 format, e.g. 2348012345678.",
  }),
  carriesLuggage: z.boolean(),
});

type PassengerFormValues = z.infer<typeof PassengerSchema>;

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  const normalized = digits.startsWith("0")
    ? `234${digits.slice(1)}`
    : digits;
  return normalized.slice(0, 13);
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0] ?? "").join("").toUpperCase() || "?";
}

const PassengerCard = ({
  passengers,
  onPassengersChange,
}: {
  passengers: Passenger[];
  onPassengersChange: (passengers: Passenger[]) => void;
}) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingPassenger, setEditingPassenger] = useState<Passenger | null>(null);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<PassengerFormValues>({
    resolver: zodResolver(PassengerSchema),
    mode: "onChange",
    defaultValues: { fullName: "", email: "", phone: "", carriesLuggage: false },
  });

  const onSavePassenger = (values: PassengerFormValues) => {
    if (editingPassenger) {
      onPassengersChange(
        passengers.map((p) =>
          p.id === editingPassenger.id
            ? {
                id: p.id,
                fullName: values.fullName.trim(),
                email: values.email,
                phone: values.phone,
                carriesLuggage: values.carriesLuggage,
              }
            : p,
        ),
      );
    } else {
      onPassengersChange([
        ...passengers,
        {
          id: crypto.randomUUID(),
          fullName: values.fullName.trim(),
          email: values.email,
          phone: values.phone,
          carriesLuggage: values.carriesLuggage,
        },
      ]);
    }
    setEditingPassenger(null);
    reset();
    setDrawerOpen(false);
  };

  const openAddDrawer = () => {
    setEditingPassenger(null);
    reset();
    setDrawerOpen(true);
  };

  const openEditDrawer = (passenger: Passenger) => {
    setEditingPassenger(passenger);
    reset({
      fullName: passenger.fullName,
      email: passenger.email,
      phone: passenger.phone,
      carriesLuggage: passenger.carriesLuggage,
    });
    setDrawerOpen(true);
  };

  const onCancel = () => {
    setEditingPassenger(null);
    reset();
    setDrawerOpen(false);
  };

  return (
    <div className="bg-white rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-neutral-900 mb-4">
        Passenger
      </h4>

      {passengers.length === 0 && (
        <p className="mb-2 rounded-xl border border-dashed border-neutral-200 bg-neutral-50 px-3 py-3 text-sm text-neutral-500">
          No travelers yet. Add who is riding — the trip holds up to{" "}
          {MAX_PASSENGERS} people.
        </p>
      )}

      {passengers.map((passenger) => (
        <div
          key={passenger.id}
          role="button"
          tabIndex={0}
          onClick={() => openEditDrawer(passenger)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openEditDrawer(passenger);
            }
          }}
          className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 mb-2 cursor-pointer"
        >
          <Avatar className="size-9">
            <AvatarFallback>{getInitials(passenger.fullName)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-neutral-900">
              {passenger.fullName}
            </p>
            <p className="truncate text-xs text-neutral-500">
              {passenger.email}
            </p>
            {passenger.carriesLuggage && (
              <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                Luggage
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPassengersChange(
                passengers.filter((item) => item.id !== passenger.id),
              );
            }}
            className="shrink-0 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            aria-label={`Remove ${passenger.fullName}`}
          >
            <X size={16} />
          </button>
        </div>
      ))}

      {!drawerOpen && passengers.length < MAX_PASSENGERS && (
        <UiButton
          type="button"
          variant="softBlue"
          className="w-full cursor-pointer"
          onClick={openAddDrawer}
        >
          <UserPlus size={16} />
          Add Passenger
        </UiButton>
      )}

      {!drawerOpen && passengers.length >= MAX_PASSENGERS && (
        <p className="text-center text-xs text-neutral-500">
          Maximum of {MAX_PASSENGERS} travelers reached.
        </p>
      )}

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>
              {editingPassenger ? "Edit Passenger" : "Add Passenger"}
            </DrawerTitle>
            <DrawerDescription>
              {editingPassenger
                ? "Update the passenger's details below."
                : "Enter the passenger's details below."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-3 overflow-y-auto">
            <Controller
              name="fullName"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="passenger-full-name"
                    className="text-xs font-medium text-neutral-600"
                  >
                    Full name
                  </Label>
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      id="passenger-full-name"
                      {...field}
                      aria-invalid={fieldState.invalid}
                      placeholder="e.g. Adaeze Obi"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                </div>
              )}
            />

            <Controller
              name="email"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="passenger-email"
                    className="text-xs font-medium text-neutral-600"
                  >
                    Email
                  </Label>
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      id="passenger-email"
                      {...field}
                      type="email"
                      aria-invalid={fieldState.invalid}
                      placeholder="passenger@example.com"
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                </div>
              )}
            />

            <Controller
              name="phone"
              control={control}
              render={({ field, fieldState }) => (
                <div className="space-y-1.5">
                  <Label
                    htmlFor="passenger-phone"
                    className="text-xs font-medium text-neutral-600"
                  >
                    Phone
                  </Label>
                  <Field data-invalid={fieldState.invalid}>
                    <Input
                      id="passenger-phone"
                      {...field}
                      type="tel"
                      inputMode="tel"
                      maxLength={13}
                      aria-invalid={fieldState.invalid}
                      placeholder="2348012345678"
                      onChange={(e) =>
                        field.onChange(normalizePhone(e.target.value))
                      }
                    />
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                </div>
              )}
            />

            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={watch("carriesLuggage")}
                onCheckedChange={(value) =>
                  setValue("carriesLuggage", value === true)
                }
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              />
              <span className="text-sm text-neutral-700">
                This passenger will carry luggage
              </span>
            </label>
          </div>

          <DrawerFooter>
            <div className="flex items-center justify-end gap-2">
              <UiButton
                type="button"
                variant="ghost"
                className="cursor-pointer"
                onClick={onCancel}
              >
                Cancel
              </UiButton>
              <UiButton
                type="button"
                variant="submit"
                className="cursor-pointer"
                disabled={!isValid}
                onClick={handleSubmit(onSavePassenger)}
              >
                Save
              </UiButton>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default PassengerCard;