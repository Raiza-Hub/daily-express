"use client";

import { CircleIcon, UserPlus, X } from "@phosphor-icons/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod/v4";
import { Button as UiButton } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Label } from "@repo/ui/components/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@repo/ui/components/sheet";
import { toast } from "@repo/ui/components/sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/avatar";
import { Checkbox } from "@repo/ui/components/checkbox";
import { Field, FieldError } from "@repo/ui/components/field";
import { formatPrice } from "@repo/ui/lib/utils";
import dayjs from "dayjs";
import type { Route } from "@shared/types";
import { isApiError, useCreateTripCheckout, useGetMe } from "@repo/api";
import { useRouter } from "next/navigation";
import { parseLocalDate } from "~/lib/utils";

interface RouteBookingSheetProps {
  route: Route;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingDate: string;
}

interface Passenger {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  carriesLuggage: boolean;
}

const BookForFriendSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, { error: "Enter the passenger's full name." }),
  email: z.email({ error: "Enter a valid email address." }),
  phone: z
    .string()
    .regex(/^234\d{10}$/, { error: "Use the 234 format, e.g. 2348012345678." }),
  carriesLuggage: z.boolean(),
});

type BookForFriendFormValues = z.infer<typeof BookForFriendSchema>;

function isValidNigerianPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, "");
  return (
    (digits.startsWith("0") && digits.length === 11) ||
    (digits.startsWith("234") && digits.length === 13)
  );
}

function formatTime(time: string): string {
  const [hours = 0, minutes = 0] = time.split(":").map(Number);
  const date = new Date("2026-01-01");
  date.setHours(hours, minutes, 0, 0);
  return dayjs(date).format("h:mma");
}

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

export default function RouteBookingSheet({
  route,
  open,
  onOpenChange,
  bookingDate,
}: RouteBookingSheetProps) {
  const router = useRouter();
  const isMock = route.id.startsWith("mock-");
  const { data: user } = useGetMe();

  const [friends, setFriends] = useState<Passenger[]>([]);
  const [friendFormOpen, setFriendFormOpen] = useState(false);
  const [leadCarriesLuggage, setLeadCarriesLuggage] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { isValid },
  } = useForm<BookForFriendFormValues>({
    resolver: zodResolver(BookForFriendSchema),
    mode: "onChange",
    defaultValues: { fullName: "", email: "", phone: "", carriesLuggage: false },
  });

  const { mutateAsync: createTripCheckout, isPending: isCreatingCheckout } =
    useCreateTripCheckout();

  useEffect(() => {
    if (open) {
      setFriends([]);
      setFriendFormOpen(false);
      setLeadCarriesLuggage(false);
      reset();
    }
  }, [open, reset]);

  const passengersCount = friends.length + 1;

  const unitPrice = route.price ?? null;
  const fee = route.fee ?? null;

  const canCheckout =
    !isMock && unitPrice !== null && fee !== null;

  const checkoutDisabled =
    isMock ? false : !canCheckout;

  const departureTime = formatTime(route.departure_time);
  const arrivalTime = formatTime(route.arrival_time);

  const primaryPhone = user?.phone ?? "";
  const primaryFullName = user
    ? `${user.firstName} ${user.lastName}`
    : "";

  const handleContinue = async () => {
    if (!isValidNigerianPhone(primaryPhone)) {
      toast.error(
        "Please add your phone number in Settings → Profile before booking.",
      );
      return;
    }

    if (isMock) {
      toast.success("Booking details saved", {
        description: JSON.stringify(
          {
            route: `${route.pickup_location_title} to ${route.dropoff_location_title}`,
            date: bookingDate,
            departure: `${departureTime} – ${arrivalTime}`,
            vehicle: "car",
            price: route.price,
            seats: passengersCount,
            phone: primaryPhone,
            passengers: [
              {
                fullName: primaryFullName,
                email: user?.email,
                phone: primaryPhone,
                carriesLuggage: leadCarriesLuggage,
              },
              ...friends.map((friend) => ({
                fullName: friend.fullName,
                email: friend.email,
                phone: friend.phone,
                carriesLuggage: friend.carriesLuggage,
              })),
            ],
          },
          null,
          2,
        ),
      });
      return;
    }

    if (!canCheckout) return;

    try {
      const checkout = await createTripCheckout({
        routeId: route.id,
        tripDate: bookingDate,
        vehicleType: "car",
        seatCount: passengersCount,
        phone: primaryPhone,
        channels: ["bank_transfer"],
        productName: `${route.pickup_location_title} to ${route.dropoff_location_title}`,
        productDescription: `Trip booking for ${dayjs(parseLocalDate(bookingDate)).format("ddd, D MMM YYYY")}`,
      });

      if (!checkout.paymentReference || !checkout.checkoutUrl) {
        throw new Error("Payment initialization failed");
      }

      window.location.assign(checkout.checkoutUrl);
    } catch (error) {
      if (isApiError(error) && error.statusCode === 401) {
        router.push("/sign-in");
        return;
      }
      const msg = error instanceof Error ? error.message : "Unable to start payment";
      toast.error(msg);
    }
  };

  const onSaveFriend = (values: BookForFriendFormValues) => {
    setFriends((prev) => [
      ...prev,
      { id: crypto.randomUUID(), ...values },
    ]);
    reset();
    setFriendFormOpen(false);
  };

  const closeFriendForm = () => {
    reset();
    setFriendFormOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetHeader>
          <SheetTitle className="text-lg">
            {route.pickup_location_title} to {route.dropoff_location_title}
          </SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-x-2">
            {dayjs(parseLocalDate(bookingDate)).format("ddd, D MMM YYYY")}
            <CircleIcon size={5} weight="fill" />
            {departureTime} – {arrivalTime}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-6">
          {user && (
            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-neutral-900">
                Passengers
              </h3>

            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5">
                <Avatar className="size-9">
                  <AvatarImage
                    className="object-cover"
                    src={user?.profilePictureUrl || ""}
                    alt={primaryFullName || "You"}
                  />
                  <AvatarFallback>{getInitials(primaryFullName)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {primaryFullName || "Loading…"}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {user
                      ? primaryPhone
                        ? user.email
                        : "Add your phone in Settings → Profile"
                      : ""}
                  </p>
                  <label className="mt-1.5 flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={leadCarriesLuggage}
                      onCheckedChange={(value) =>
                        setLeadCarriesLuggage(value === true)
                      }
                      className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                    />
                    <span className="text-xs text-neutral-600">
                      Carry luggage
                    </span>
                  </label>
                </div>
                <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                  You
                </span>
              </div>

              {friends.map((friend) => (
                <div
                  key={friend.id}
                  className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
                >
                  <Avatar className="size-9">
                    <AvatarFallback>{getInitials(friend.fullName)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {friend.fullName}
                    </p>
                    <p className="truncate text-xs text-neutral-500">
                      {friend.email}
                    </p>
                    {friend.carriesLuggage && (
                      <span className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        Luggage
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFriends((prev) =>
                        prev.filter((item) => item.id !== friend.id),
                      )
                    }
                    className="shrink-0 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label={`Remove ${friend.fullName}`}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}

              {!friendFormOpen && friends.length < 3 && (
                <UiButton
                  type="button"
                  variant="softBlue"
                  className="w-full cursor-pointer"
                  onClick={() => setFriendFormOpen(true)}
                >
                  <UserPlus size={16} />
                  Book for a Friend
                </UiButton>
              )}

              {!friendFormOpen && friends.length >= 3 && (
                <p className="text-center text-xs text-neutral-500">
                  Maximum of 3 additional passengers reached.
                </p>
              )}

              {friendFormOpen && (
                <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                  <Controller
                    name="fullName"
                    control={control}
                    render={({ field, fieldState }) => (
                      <div className="space-y-1.5">
                        <Label
                          htmlFor="friend-full-name"
                          className="text-xs font-medium text-neutral-600"
                        >
                          Full name
                        </Label>
                        <Field data-invalid={fieldState.invalid}>
                          <Input
                            id="friend-full-name"
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
                          htmlFor="friend-email"
                          className="text-xs font-medium text-neutral-600"
                        >
                          Email
                        </Label>
                        <Field data-invalid={fieldState.invalid}>
                          <Input
                            id="friend-email"
                            {...field}
                            type="email"
                            aria-invalid={fieldState.invalid}
                            placeholder="friend@example.com"
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
                          htmlFor="friend-phone"
                          className="text-xs font-medium text-neutral-600"
                        >
                          Phone
                        </Label>
                        <Field data-invalid={fieldState.invalid}>
                          <Input
                            id="friend-phone"
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

                  <div className="flex items-center justify-end gap-2">
                    <UiButton
                      type="button"
                      variant="ghost"
                      className="cursor-pointer"
                      onClick={closeFriendForm}
                    >
                      Cancel
                    </UiButton>
                    <UiButton
                      type="button"
                      variant="submit"
                      className="cursor-pointer"
                      disabled={!isValid}
                      onClick={handleSubmit(onSaveFriend)}
                    >
                      Save
                    </UiButton>
                  </div>
                </div>
              )}
            </div>
            </section>
          )}
        </div>

        <SheetFooter>
          <div className="flex items-center justify-between w-full">
            <span className="text-lg font-medium text-neutral-900">Total</span>
            <span className="text-xl font-semibold text-neutral-900">
              {unitPrice !== null && fee !== null
                ? formatPrice((unitPrice + fee) * passengersCount)
                : "—"}
            </span>
          </div>
          <UiButton
            size="lg"
            className="w-full gap-2 font-medium bg-blue-600 hover:bg-blue-700 text-white"
            onClick={handleContinue}
            disabled={checkoutDisabled || isCreatingCheckout}
          >
            {isCreatingCheckout ? "Starting payment…" : "Checkout"}
          </UiButton>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}