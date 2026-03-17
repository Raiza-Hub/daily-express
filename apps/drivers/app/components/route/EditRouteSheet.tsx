"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routeSchema, TRoute, AWSPlaceDetails } from "@repo/types/index";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { Input } from "@repo/ui/components/input";
import { Textarea } from "@repo/ui/components/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/ui/components/select";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@repo/ui/components/field";
import { LocationDropdown } from "@repo/ui/components/location-dropdown";
import { ClockIcon, NotePencilIcon } from "@phosphor-icons/react";
import { DateInput, TimeField } from "@repo/ui/components/datefield-rac";
import { dateToTime, timeToDate, formatPrice } from "@repo/ui/lib/utils";
import { useEffect, useRef, useState } from "react";
import type { LocationSuggestion } from "@repo/ui/components/location-dropdown";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { useDebouncedCallback } from "@repo/ui/hooks/use-debounced-callback";
import { getPlaceDetails, suggestLocations } from "@repo/ui/lib/location";


interface EditRouteSheetProps {
    defaultValues: Partial<TRoute>;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

const VEHICLE_TYPE = [
    { label: "Car", value: "car" },
    { label: "Bus", value: "bus" },
    { label: "Luxury Car", value: "luxury car" },
] as const

export default function EditRouteSheet({
    defaultValues,
    open,
    onOpenChange,
}: EditRouteSheetProps) {
    const isControlled = open !== undefined;
    const {
        handleSubmit,
        control,
        formState: { isSubmitting }
    } = useForm<TRoute>({
        resolver: zodResolver(routeSchema),
        defaultValues: defaultValues
    });

    // Local state for location dropdown visibility & query text
    const [departureCityQuery, setDepartureCityQuery] = useState(
        defaultValues?.departureCity?.title ?? ""
    );

    const [arrivalCityQuery, setArrivalCityQuery] = useState(
        defaultValues?.arrivalCity?.title ?? ""
    );

    const [departureSuggestions, setDepartureSuggestions] = useState<LocationSuggestion[]>([]);
    const [arrivalSuggestions, setArrivalSuggestions] = useState<LocationSuggestion[]>([]);

    const [isDepartureLoading, setIsDepartureLoading] = useState(false);
    const [isArrivalLoading, setIsArrivalLoading] = useState(false);

    const [showDepartureDropdown, setShowDepartureDropdown] = useState(false);
    const [showArrivalDropdown, setShowArrivalDropdown] = useState(false);

    // Price display state: formatted when blurred, raw when focused
    const [priceDisplay, setPriceDisplay] = useState(
        defaultValues?.price ? formatPrice(defaultValues.price) : ""
    );
    const [isPriceFocused, setIsPriceFocused] = useState(false);

    const departureCityRef = useRef<HTMLDivElement>(null);
    const arrivalCityRef = useRef<HTMLDivElement>(null);


    /* -------------------------------------------------- */
    /* DEBOUNCED SEARCH FUNCTIONS */
    /* -------------------------------------------------- */

    const fetchDepartureSuggestions = useDebouncedCallback(async (query: string) => {
        const res = await suggestLocations(query);
        setDepartureSuggestions(res);
        setIsDepartureLoading(false);
    }, 400);

    const fetchArrivalSuggestions = useDebouncedCallback(async (query: string) => {
        const res = await suggestLocations(query);
        setArrivalSuggestions(res);
        setIsArrivalLoading(false);
    }, 400);

    /* -------------------------------------------------- */
    /* CLOSE DROPDOWN ON OUTSIDE CLICK */
    /* -------------------------------------------------- */

    useClickOutside([departureCityRef, arrivalCityRef], () => {
        setShowDepartureDropdown(false)
        setShowArrivalDropdown(false)
    })



    const onSubmit = (data: TRoute) => {
        console.log("Form submitted:", data);
    };

    return (
        <Sheet open={isControlled ? open : undefined} onOpenChange={isControlled ? onOpenChange : undefined}>
            {!isControlled && (
                <SheetTrigger className='group flex items-center p-2 cursor-pointer' asChild>
                    <Button
                        size="icon-lg"
                        className="rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
                    >
                        <NotePencilIcon size={18} />
                    </Button>
                </SheetTrigger>
            )}
            <SheetContent onOpenAutoFocus={(e) => e.preventDefault()} className="w-full sm:max-w-[540px] overflow-y-auto">
                <SheetHeader className="pb-4 border-b px-6">
                    <SheetTitle className="text-xl font-semibold">Edit Route</SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground mt-1">
                        Update the route details and schedule information below.
                    </SheetDescription>
                </SheetHeader>

                <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 py-6 px-6">

                    {/* Route Information */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Route Information
                        </h3>
                        <FieldGroup>
                            <div className="grid gap-6">

                                {/* Departure City */}
                                <Controller
                                    name="departureCity"
                                    control={control}
                                    render={({ field, fieldState }) => (

                                        <Field data-invalid={fieldState.invalid}>

                                            <FieldLabel>Departure Location</FieldLabel>

                                            <div ref={departureCityRef} className="relative">

                                                <Input
                                                    value={departureCityQuery}
                                                    placeholder="e.g. Paris"
                                                    autoComplete="off"

                                                    onFocus={() => {
                                                        if (departureCityQuery.length > 1) {
                                                            setShowDepartureDropdown(true);
                                                        }
                                                        setShowArrivalDropdown(false);
                                                    }}

                                                    onChange={(e) => {

                                                        const value = e.target.value;

                                                        setDepartureCityQuery(value);

                                                        field.onChange({
                                                            title: value,
                                                            locality: "Unknown",
                                                            label: value,
                                                        });

                                                        setShowDepartureDropdown(true);
                                                        setShowArrivalDropdown(false);

                                                        if (value.length > 1) {
                                                            setShowDepartureDropdown(true);
                                                            setIsDepartureLoading(true);
                                                            fetchDepartureSuggestions(value);
                                                        } else {
                                                            fetchDepartureSuggestions.cancel();
                                                            setDepartureSuggestions([]);
                                                            setIsDepartureLoading(false);
                                                            setShowDepartureDropdown(false);
                                                        }
                                                    }}
                                                />

                                                <LocationDropdown
                                                    query={departureCityQuery}
                                                    visible={showDepartureDropdown}
                                                    suggestions={departureSuggestions}
                                                    isLoading={isDepartureLoading}

                                                    onSelect={async (loc) => {

                                                        setDepartureCityQuery(loc.title);

                                                        field.onChange({
                                                            title: loc.title,
                                                            locality: "Loading...",
                                                            label: loc.label || "",
                                                        });

                                                        setShowDepartureDropdown(false);

                                                        const details = await getPlaceDetails(loc.placeId) as AWSPlaceDetails | null;
                                                        console.log(details);

                                                        if (details?.Address) {
                                                            field.onChange({
                                                                title: loc.title,
                                                                locality:
                                                                    details.Address.Locality ||
                                                                    details.Address.City ||
                                                                    loc.title,
                                                                label:
                                                                    details.Address.Label ||
                                                                    loc.label ||
                                                                    "",
                                                            });
                                                        }
                                                    }}
                                                />

                                            </div>

                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}

                                        </Field>
                                    )}
                                />

                                {/* Arrival City */}
                                <Controller
                                    name="arrivalCity"
                                    control={control}
                                    render={({ field, fieldState }) => (

                                        <Field data-invalid={fieldState.invalid}>

                                            <FieldLabel>Arrival Location</FieldLabel>

                                            <div ref={arrivalCityRef} className="relative">

                                                <Input
                                                    value={arrivalCityQuery}
                                                    placeholder="e.g. Lyon"
                                                    autoComplete="off"

                                                    onFocus={() => {
                                                        if (arrivalCityQuery.length > 1) {
                                                            setShowArrivalDropdown(true);
                                                        }
                                                        setShowDepartureDropdown(false);
                                                    }}

                                                    onChange={(e) => {

                                                        const value = e.target.value;

                                                        setArrivalCityQuery(value);

                                                        field.onChange({
                                                            title: value,
                                                            locality: "Unknown",
                                                            label: value,
                                                        });

                                                        setShowArrivalDropdown(true);
                                                        setShowDepartureDropdown(false);

                                                        if (value.length > 1) {
                                                            setShowArrivalDropdown(true);
                                                            setIsArrivalLoading(true);
                                                            fetchArrivalSuggestions(value);
                                                        } else {
                                                            fetchArrivalSuggestions.cancel();
                                                            setArrivalSuggestions([]);
                                                            setIsArrivalLoading(false);
                                                            setShowArrivalDropdown(false);
                                                        }
                                                    }}
                                                />

                                                <LocationDropdown
                                                    query={arrivalCityQuery}
                                                    visible={showArrivalDropdown}
                                                    suggestions={arrivalSuggestions}
                                                    isLoading={isArrivalLoading}

                                                    onSelect={async (loc) => {

                                                        setArrivalCityQuery(loc.title);

                                                        field.onChange({
                                                            title: loc.title,
                                                            locality: "Loading...",
                                                            label: loc.label || "",
                                                        });

                                                        setShowArrivalDropdown(false);

                                                        const details = await getPlaceDetails(loc.placeId) as AWSPlaceDetails | null;

                                                        if (details?.Address) {
                                                            field.onChange({
                                                                title: loc.title,
                                                                locality:
                                                                    details.Address.Locality ||
                                                                    details.Address.City ||
                                                                    loc.title,
                                                                label:
                                                                    details.Address.Label ||
                                                                    loc.label ||
                                                                    "",
                                                            });
                                                        }
                                                    }}
                                                />

                                            </div>

                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}

                                        </Field>
                                    )}
                                />

                                {/* Meeting Point */}
                                <div className="grid gap-2">
                                    <Controller
                                        name="meetingPoint"
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel htmlFor="meetingPoint">
                                                    Meeting Point
                                                </FieldLabel>
                                                <Textarea
                                                    {...field}
                                                    id="meetingPoint"
                                                    aria-invalid={fieldState.invalid}
                                                    placeholder="e.g. Gare du Nord, main entrance"
                                                    autoComplete="off"
                                                    rows={3}
                                                />
                                                {fieldState.invalid && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                </div>

                            </div>
                        </FieldGroup>
                    </div>

                    {/* Vehicle & Pricing */}
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
                                                <FieldLabel htmlFor="vehicleType">
                                                    Vehicle Type
                                                </FieldLabel>
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
                                                        {VEHICLE_TYPE.map((v) => (
                                                            <SelectItem key={v.value} value={v.value}>
                                                                {v.label}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                {fieldState.invalid && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
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
                                                <FieldLabel htmlFor="seatNumber">
                                                    Seat Number
                                                </FieldLabel>
                                                <Input
                                                    {...field}
                                                    id="seatNumber"
                                                    type="number"
                                                    aria-invalid={fieldState.invalid}
                                                    placeholder="e.g. 4"
                                                    autoComplete="off"
                                                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
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
                                        name="price"
                                        control={control}
                                        render={({ field, fieldState }) => (
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel htmlFor="price">
                                                    Price
                                                </FieldLabel>
                                                <div className="relative flex rounded-md shadow-xs">
                                                    <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground text-sm">
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
                                                        value={priceDisplay}
                                                        onFocus={() => {
                                                            setIsPriceFocused(true);
                                                            // show raw number while editing
                                                            setPriceDisplay(field.value ? String(field.value) : "");
                                                        }}
                                                        onChange={(e) => {
                                                            const raw = e.target.value.replace(/[^0-9.]/g, "");
                                                            setPriceDisplay(raw);
                                                            field.onChange(raw === "" ? 0 : parseFloat(raw));
                                                        }}
                                                        onBlur={() => {
                                                            setIsPriceFocused(false);
                                                            // format on blur
                                                            const num = parseFloat(priceDisplay);
                                                            setPriceDisplay(isNaN(num) || num === 0 ? "" : formatPrice(num));
                                                            field.onBlur();
                                                        }}
                                                    />
                                                    <span className="-z-10 inline-flex items-center rounded-e-md border border-input bg-background px-3 text-muted-foreground text-sm">
                                                        NGN
                                                    </span>
                                                </div>
                                                {fieldState.invalid && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        )}
                                    />
                                </div>

                            </div>
                        </FieldGroup>
                    </div>

                    {/* Schedule Details */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                            Schedule Details
                        </h3>
                        <FieldGroup>
                            <div className="grid gap-6">

                                <Controller
                                    name="departureTime"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <TimeField
                                            value={dateToTime(field.value)}
                                            onChange={(time) => {
                                                if (!time) {
                                                    field.onChange(null)
                                                    return
                                                }
                                                field.onChange(timeToDate(time, field.value))
                                            }}
                                        >
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel>Departure Time</FieldLabel>
                                                <div className="relative">
                                                    <DateInput aria-invalid={fieldState.invalid} />
                                                    <div className="pointer-events-none absolute inset-y-0 end-0 z-10 flex items-center pe-3 text-muted-foreground/80">
                                                        <ClockIcon size={16} />
                                                    </div>
                                                </div>
                                                {fieldState.invalid && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        </TimeField>
                                    )}
                                />

                                <Controller
                                    name="estimatedArrivalTime"
                                    control={control}
                                    render={({ field, fieldState }) => (
                                        <TimeField
                                            value={dateToTime(field.value)}
                                            onChange={(time) => {
                                                if (!time) {
                                                    field.onChange(null)
                                                    return
                                                }
                                                field.onChange(timeToDate(time, field.value))
                                            }}
                                        >
                                            <Field data-invalid={fieldState.invalid}>
                                                <FieldLabel>Estimated Arrival Time</FieldLabel>
                                                <div className="relative">
                                                    <DateInput aria-invalid={fieldState.invalid} />
                                                    <div className="pointer-events-none absolute inset-y-0 end-0 z-10 flex items-center pe-3 text-muted-foreground/80">
                                                        <ClockIcon size={16} />
                                                    </div>
                                                </div>
                                                {fieldState.invalid && (
                                                    <FieldError errors={[fieldState.error]} />
                                                )}
                                            </Field>
                                        </TimeField>
                                    )}
                                />

                            </div>
                        </FieldGroup>
                    </div>

                    <SheetFooter className="pt-4 pb-0">
                        <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 cursor-pointer">
                            {isSubmitting ? "Saving..." : "Save Changes"}
                        </Button>
                    </SheetFooter>
                </form>
            </SheetContent>
        </Sheet>
    );
}
