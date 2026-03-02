"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routeSchema, TRoute } from "@repo/types/index";
import { Button } from "@repo/ui/components/button";
import { MapPinPlusIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";
import { CreateRouteForm } from "./route/CreateRouteForm";
import { ResponsiveModal } from "@repo/ui/ResponsiveModal";

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

    const [arrivalCityQuery, setArrivalCityQuery] = useState("");
    const [showArrivalDropdown, setShowArrivalDropdown] = useState(false);
    const arrivalCityRef = useRef<HTMLDivElement>(null);

    const [priceDisplay, setPriceDisplay] = useState("");

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
        arrivalCityQuery,
        setArrivalCityQuery,
        showArrivalDropdown,
        setShowArrivalDropdown,
        arrivalCityRef: arrivalCityRef as React.RefObject<HTMLDivElement>,
        priceDisplay,
        setPriceDisplay,
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
