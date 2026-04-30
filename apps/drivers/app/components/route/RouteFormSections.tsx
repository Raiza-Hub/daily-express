"use client";

import { Controller, type Control } from "react-hook-form";
import { ClockIcon } from "@phosphor-icons/react";
import type { TRoute } from "@repo/types";
import { DateInput, TimeField } from "@repo/ui/components/datefield-rac";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@repo/ui/components/field";
import { Input } from "@repo/ui/components/input";
import { LocationDropdown } from "@repo/ui/components/location-dropdown";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui/components/select";
import { Textarea } from "@repo/ui/components/textarea";
import { dateToTime, timeToDate } from "@repo/ui/lib/utils";
import type { RouteFormUi, RouteLocationUi } from "./useRouteFormUi";

const VEHICLE_TYPE = [
  { label: "Car", value: "car" },
  { label: "Bus", value: "bus" },
  { label: "Luxury Car", value: "luxury_car" },
] as const;

function RouteLocationField({
  control,
  name,
  label,
  placeholder,
  ui,
  otherUi,
}: {
  control: Control<TRoute>;
  name: "departureCity" | "arrivalCity";
  label: string;
  placeholder: string;
  ui: RouteLocationUi;
  otherUi: RouteLocationUi;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor={name}>{label}</FieldLabel>
          <div ref={ui.ref} className="relative">
            <Input
              id={name}
              value={ui.query}
              aria-invalid={fieldState.invalid}
              placeholder={placeholder}
              autoComplete="off"
              onFocus={() => ui.focus(otherUi)}
              onChange={(event) =>
                ui.handleInputChange(
                  event.target.value,
                  field.onChange,
                  otherUi,
                )
              }
            />
            <LocationDropdown
              query={ui.query}
              visible={ui.isOpen}
              suggestions={ui.suggestions}
              isLoading={ui.isLoading}
              message={ui.message}
              onSelect={(location) => ui.handleSelect(location, field.onChange)}
            />
          </div>
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}

export function RouteInformationSection({
  control,
  ui,
}: {
  control: Control<TRoute>;
  ui: RouteFormUi;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Route Information
      </h3>
      <FieldGroup>
        <div className="grid gap-6">
          <div className="grid gap-2">
            <RouteLocationField
              control={control}
              name="departureCity"
              label="Departure Location"
              placeholder="e.g. Paris"
              ui={ui.departure}
              otherUi={ui.arrival}
            />
          </div>

          <div className="grid gap-2">
            <RouteLocationField
              control={control}
              name="arrivalCity"
              label="Arrival Location"
              placeholder="e.g. Lyon"
              ui={ui.arrival}
              otherUi={ui.departure}
            />
          </div>

          <div className="grid gap-2">
            <Controller
              name="meetingPoint"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="meetingPoint">Meeting Point</FieldLabel>
                  <Textarea
                    {...field}
                    id="meetingPoint"
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. Gare du Nord, main entrance"
                    autoComplete="off"
                    rows={3}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
          </div>
        </div>
      </FieldGroup>
    </div>
  );
}

export function RoutePricingSection({
  control,
  ui,
}: {
  control: Control<TRoute>;
  ui: RouteFormUi;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Vehicle &amp; Pricing
      </h3>
      <FieldGroup>
        <div className="grid gap-6">
          <div className="grid gap-2">
            <Controller
              name="vehicleType"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="vehicleType">Vehicle Type</FieldLabel>
                  <Select
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger
                      id="vehicleType"
                      aria-invalid={fieldState.invalid}
                      className="w-full"
                    >
                      <SelectValue placeholder="Select vehicle type" />
                    </SelectTrigger>
                    <SelectContent position="item-aligned">
                      {VEHICLE_TYPE.map((vehicle) => (
                        <SelectItem key={vehicle.value} value={vehicle.value}>
                          {vehicle.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
          </div>

          <div className="grid gap-2">
            <Controller
              name="seatNumber"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="seatNumber">Seat Number</FieldLabel>
                  <Input
                    {...field}
                    id="seatNumber"
                    type="number"
                    min={1}
                    aria-invalid={fieldState.invalid}
                    placeholder="e.g. 4"
                    autoComplete="off"
                    onKeyDown={(e) => {
                      if (["-", "e", "E", "+"].includes(e.key)) {
                        e.preventDefault();
                      }
                    }}
                    onChange={(event) => {
                      const val = event.target.valueAsNumber;
                      field.onChange(Number.isNaN(val) ? "" : Math.max(1, val));
                    }}
                  />
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
          </div>

          <div className="grid gap-2">
            <Controller
              name="price"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="price">Price</FieldLabel>
                  <div className="relative flex rounded-md shadow-xs">
                    <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-sm text-muted-foreground">
                      ₦
                    </span>
                    <Input
                      id="price"
                      type="text"
                      inputMode="numeric"
                      aria-invalid={fieldState.invalid}
                      placeholder="0.00"
                      autoComplete="off"
                      className="ps-7"
                      value={ui.price.display}
                      onFocus={() => ui.price.handleFocus(field.value)}
                      onChange={(event) =>
                        ui.price.handleChange(
                          event.target.value,
                          field.onChange,
                        )
                      }
                      onBlur={() => ui.price.handleBlur(field.onBlur)}
                    />
                    <span className="-z-10 inline-flex items-center rounded-e-md border border-input bg-background px-3 text-sm text-muted-foreground">
                      NGN
                    </span>
                  </div>
                  {fieldState.invalid ? (
                    <FieldError errors={[fieldState.error]} />
                  ) : null}
                </Field>
              )}
            />
          </div>
        </div>
      </FieldGroup>
    </div>
  );
}

function RouteTimeField({
  control,
  name,
  label,
}: {
  control: Control<TRoute>;
  name: "departureTime" | "estimatedArrivalTime";
  label: string;
}) {
  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <TimeField
          aria-label={label}
          value={dateToTime(field.value)}
          onChange={(time) => {
            if (!time) {
              field.onChange(null);
              return;
            }
            field.onChange(timeToDate(time, field.value));
          }}
        >
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel>{label}</FieldLabel>
            <div className="relative">
              <DateInput aria-invalid={fieldState.invalid} />
              <div className="pointer-events-none absolute inset-y-0 end-0 z-10 flex items-center pe-3 text-muted-foreground/80">
                <ClockIcon size={16} />
              </div>
            </div>
            {fieldState.invalid ? (
              <FieldError errors={[fieldState.error]} />
            ) : null}
          </Field>
        </TimeField>
      )}
    />
  );
}

export function RouteScheduleSection({
  control,
}: {
  control: Control<TRoute>;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Schedule Details
      </h3>
      <FieldGroup>
        <div className="grid gap-6">
          <RouteTimeField
            control={control}
            name="departureTime"
            label="Departure Time"
          />
          <RouteTimeField
            control={control}
            name="estimatedArrivalTime"
            label="Estimated Arrival Time"
          />
        </div>
      </FieldGroup>
    </div>
  );
}
