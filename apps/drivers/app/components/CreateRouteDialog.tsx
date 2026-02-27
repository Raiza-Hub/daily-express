"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routeSchema, TRoute } from "@repo/types/index";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@repo/ui/components/dialog";
import { Button } from "@repo/ui/components/button";
import { MapPinPlusIcon, XIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@repo/ui/hooks/use-is-mobile";
import { CreateRouteForm } from "./route/CreateRouteForm";

export default function CreateRouteDialog() {
    const [open, setOpen] = useState(false);
    const isMobile = useIsMobile();

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

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (departureCityRef.current && !departureCityRef.current.contains(e.target as Node))
                setShowDepartureDropdown(false);
            if (arrivalCityRef.current && !arrivalCityRef.current.contains(e.target as Node))
                setShowArrivalDropdown(false);
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Lock body scroll when mobile panel is open
    useEffect(() => {
        if (isMobile && open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [isMobile, open]);

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

    if (isMobile === undefined) return null;

    if (isMobile) {
        return (
            <>
                <Button
                    className="w-full sm:w-auto cursor-pointer"
                    variant="secondary"
                    onClick={() => setOpen(true)}
                >
                    <MapPinPlusIcon className="h-6 w-6" weight="bold" />
                    Create Route
                </Button>

                {open && (
                    <>
                        {/* Overlay */}
                        <div
                            className="fixed inset-0 z-50 bg-black/50"
                            onClick={handleClose}
                        />

                        {/* Panel */}
                        <div className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden">
                            {/* Header */}
                            <div className="flex items-start justify-between p-4 border-b shrink-0">
                                <div>
                                    <h2 className="text-xl font-semibold">Create Route</h2>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Fill in the route details and schedule information below.
                                    </p>
                                </div>
                                <Button
                                    onClick={handleClose}
                                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                                    aria-label="Close"
                                    variant="ghost"
                                >
                                    <XIcon className="h-5 w-5" />
                                </Button>
                            </div>

                            {/* Scrollable content */}
                            <div className="flex-1 overflow-y-auto px-4">
                                <CreateRouteForm
                                    {...formProps}
                                    FooterWrapper={({ children }) => (
                                        <div className="pt-4 pb-4 border-t flex justify-end gap-2">
                                            {children}
                                        </div>
                                    )}
                                />
                            </div>
                        </div>
                    </>
                )}
            </>
        );
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" variant="secondary">
                    <MapPinPlusIcon className="h-6 w-6" weight="bold" />
                    Create Route
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[540px] max-h-[90vh] overflow-y-auto">
                <DialogHeader className="pb-4 border-b px-0">
                    <DialogTitle className="text-xl font-semibold">Create Route</DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground mt-1">
                        Fill in the route details and schedule information below.
                    </DialogDescription>
                </DialogHeader>
                <CreateRouteForm
                    {...formProps}
                    FooterWrapper={({ children }) => (
                        <div className="pt-4 pb-0 border-t flex justify-end gap-2">
                            {children}
                        </div>
                    )}
                />
            </DialogContent>
        </Dialog>
    );
}
