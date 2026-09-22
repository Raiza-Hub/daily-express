"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@repo/ui/Drawer";
import { Button } from "~/components/ui/button";
import { Field } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  PHONE_PLACEHOLDER,
  isValidNigerianPhone,
  normalizePhone,
  formatPhoneDisplay,
} from "~/lib/phone";
import type { PassengerInput } from "@shared/types";

export interface TripPassenger extends PassengerInput {
  id: string;
}

export const MAX_PASSENGERS = 4;

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

interface PassengerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  passengers: TripPassenger[];
  onPassengersChange: (passengers: TripPassenger[]) => void;
  editingId: string | null;
  onEditingChange: (id: string | null) => void;
}

const emptyForm = () => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  carriesLuggage: false,
});

function splitFullName(fullName: string) {
  const [firstName = "", ...rest] = fullName.split(" ");
  return { firstName, lastName: rest.join(" ").trim() };
}

function PassengerDrawer({
  open,
  onOpenChange,
  passengers,
  onPassengersChange,
  editingId,
  onEditingChange,
}: PassengerDrawerProps) {
  const [form, setForm] = useState(emptyForm);
  const [touched, setTouched] = useState(false);

  const isEditing = editingId !== null;
  const editingPassenger = isEditing
    ? (passengers.find((passenger) => passenger.id === editingId) ?? null)
    : null;

  useEffect(() => {
    if (!open) return;
    if (editingPassenger) {
      const { firstName, lastName } = splitFullName(editingPassenger.fullName);
      setForm({
        firstName,
        lastName,
        email: editingPassenger.email,
        phone: formatPhoneDisplay(editingPassenger.phone),
        carriesLuggage: editingPassenger.carriesLuggage,
      });
    } else {
      setForm(emptyForm());
    }
    setTouched(false);
  }, [open, editingPassenger]);

  const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();

  const phoneValid = isValidNigerianPhone(form.phone);

  const formValid =
    form.firstName.trim().length > 0 &&
    form.lastName.trim().length > 0 &&
    EMAIL_PATTERN.test(form.email.trim()) &&
    phoneValid;

  const errors = useMemo(() => {
    if (!touched) return {};
    const result: Record<string, string> = {};
    if (!form.firstName.trim())
      result.firstName = "Enter the passenger's first name.";
    if (!form.lastName.trim())
      result.lastName = "Enter the passenger's last name.";
    if (!EMAIL_PATTERN.test(form.email.trim()))
      result.email = "Enter a valid email address.";
    if (!phoneValid)
      result.phone = form.phone.trim() === ""
        ? "Enter the passenger's phone number."
        : "Use the 234 format, e.g. 2348012345678.";
    return result;
  }, [touched, form, phoneValid]);

  const close = () => {
    onOpenChange(false);
    onEditingChange(null);
    setTouched(false);
  };

  const handleSave = () => {
    setTouched(true);
    if (!formValid) return;
    if (isEditing) {
      onPassengersChange(
        passengers.map((passenger) =>
          passenger.id === editingId
            ? {
              ...passenger,
              fullName,
              email: form.email.trim(),
              phone: normalizePhone(form.phone),
              carriesLuggage: form.carriesLuggage,
            }
            : passenger,
        ),
      );
    } else {
      onPassengersChange([
        ...passengers,
        {
          id: crypto.randomUUID(),
          fullName,
          email: form.email.trim(),
          phone: normalizePhone(form.phone),
          carriesLuggage: form.carriesLuggage,
        },
      ]);
    }
    close();
  };

  const setField = <K extends keyof ReturnType<typeof emptyForm>>(
    key: K,
    value: ReturnType<typeof emptyForm>[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-lg">
          <DrawerHeader className="sm:text-left">
            <DrawerTitle>
              {isEditing ? "Edit passenger" : "Add passenger"}
            </DrawerTitle>
            <DrawerDescription>
              Fill in this passenger&apos;s travel details.
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex flex-col gap-4 px-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="passenger-first-name" error={errors.firstName}>
                <Input
                  id="passenger-first-name"
                  value={form.firstName}
                  invalid={Boolean(errors.firstName)}
                  placeholder="e.g. Ade"
                  onChange={(event) => setField("firstName", event.target.value)}
                />
              </Field>
              <Field label="Last name" htmlFor="passenger-last-name" error={errors.lastName}>
                <Input
                  id="passenger-last-name"
                  value={form.lastName}
                  invalid={Boolean(errors.lastName)}
                  placeholder="e.g. Bello"
                  onChange={(event) => setField("lastName", event.target.value)}
                />
              </Field>
              <Field label="Email" htmlFor="passenger-email" error={errors.email}>
                <Input
                  id="passenger-email"
                  type="email"
                  value={form.email}
                  invalid={Boolean(errors.email)}
                  placeholder="ade.bello@example.com"
                  onChange={(event) => setField("email", event.target.value)}
                />
              </Field>
              <Field label="Phone number" htmlFor="passenger-phone" error={errors.phone}>
                <Input
                  id="passenger-phone"
                  inputMode="numeric"
                  value={form.phone}
                  invalid={Boolean(errors.phone)}
                  placeholder={PHONE_PLACEHOLDER}
                  onChange={(event) =>
                    setField("phone", formatPhoneDisplay(event.target.value))
                  }
                />
              </Field>
            </div>

            <label
              htmlFor="passenger-luggage"
              className="flex cursor-pointer items-center gap-3 py-2 transition-colors"
            >
              <input
                id="passenger-luggage"
                type="checkbox"
                checked={form.carriesLuggage}
                onChange={(event) =>
                  setField("carriesLuggage", event.target.checked)
                }
                className="h-4 w-4 rounded-md accent-neutral-900"
              />
              <span className="text-sm text-foreground">
                Bringing luggage along for this trip
              </span>
            </label>
          </div>
        </div>
        <DrawerFooter>
          <Button
            type="button"
            onClick={handleSave}
            pill
            disabled={!formValid}
            className="font-semibold text-sm"
          >
            {isEditing ? "Save changes" : "Add passenger"}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

export { PassengerDrawer };