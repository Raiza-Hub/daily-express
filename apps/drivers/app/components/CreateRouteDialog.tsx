"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routeSchema, TRoute } from "@repo/types/index";
import { Button } from "@repo/ui/components/button";
import { MapPinPlusIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { CreateRouteForm } from "./route/CreateRouteForm";
import { ResponsiveModal } from "@repo/ui/ResponsiveModal";
import type { LocationSuggestion } from "@repo/ui/components/location-dropdown";
import { useEffect } from "react";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { useDebouncedCallback } from "@repo/ui/hooks/use-debounced-callback";
import { suggestLocations } from "@repo/ui/lib/location";

export default function CreateRouteDialog() {
    const [open, setOpen] = useState(false);

    const {
        handleSubmit,
        control,
        reset,
        formState: { isSubmitting },
    } = useForm<TRoute>({
        resolver: zodResolver(routeSchema),
        defaultValues: {},
    });

    const [departureCityQuery, setDepartureCityQuery] = useState("");
    const [showDepartureDropdown, setShowDepartureDropdown] = useState(false);
    const departureCityRef = useRef<HTMLDivElement>(null);

    const [departureSuggestions, setDepartureSuggestions] = useState<LocationSuggestion[]>([]);
    const [isDepartureLoading, setIsDepartureLoading] = useState(false);

    const [arrivalCityQuery, setArrivalCityQuery] = useState("");
    const [showArrivalDropdown, setShowArrivalDropdown] = useState(false);
    const arrivalCityRef = useRef<HTMLDivElement>(null);
    const [arrivalSuggestions, setArrivalSuggestions] = useState<LocationSuggestion[]>([]);
    const [isArrivalLoading, setIsArrivalLoading] = useState(false);

    const [priceDisplay, setPriceDisplay] = useState("");

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

    useClickOutside([departureCityRef, arrivalCityRef], () => {
        setShowDepartureDropdown(false)
        setShowArrivalDropdown(false)
    })

    const handleClose = () => {
        setOpen(false);
        reset();
        setDepartureCityQuery("");
        setArrivalCityQuery("");
        setPriceDisplay("");
    };

    const onSubmit = (data: TRoute) => {
        console.log("New route created:", data);
        handleClose();
    };

    const formProps = {
        control,
        handleSubmit,
        isSubmitting,
        onSubmit,
        onCancel: handleClose,
        departureCityQuery,
        setDepartureCityQuery,
        showDepartureDropdown,
        setShowDepartureDropdown,
        departureCityRef: departureCityRef as React.RefObject<HTMLDivElement>,
        departureSuggestions,
        isDepartureLoading,
        arrivalCityQuery,
        setArrivalCityQuery,
        showArrivalDropdown,
        setShowArrivalDropdown,
        arrivalCityRef: arrivalCityRef as React.RefObject<HTMLDivElement>,
        arrivalSuggestions,
        isArrivalLoading,
        priceDisplay,
        setPriceDisplay,
        fetchDepartureSuggestions,
        fetchArrivalSuggestions,
        setIsDepartureLoading,
        setIsArrivalLoading,
        setDepartureSuggestions,
        setArrivalSuggestions
    };

    return (
        <ResponsiveModal
            open={open}
            onOpenChange={(val) => {
                if (!val) handleClose();
                else setOpen(true);
            }}
            trigger={
                <Button
                    className="w-full sm:w-auto cursor-pointer"
                    variant="secondary"
                >
                    <MapPinPlusIcon className="h-6 w-6" weight="bold" />
                    Create Route
                </Button>
            }
            title="Create Route"
            description="Fill in the route details and schedule information below."
        >
            <CreateRouteForm
                {...formProps}
                FooterWrapper={({ children }) => (
                    <div className="pt-4 pb-4 border-t flex justify-end gap-2">
                        {children}
                    </div>
                )}
            />
        </ResponsiveModal>
    );
}
