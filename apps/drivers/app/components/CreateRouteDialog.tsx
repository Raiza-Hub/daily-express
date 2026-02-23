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
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@repo/ui/components/drawer";
import { Button } from "@repo/ui/components/button";
import { MapPinPlusIcon } from "@phosphor-icons/react";
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

    if (isMobile) {
        return (
            <Drawer open={open} onOpenChange={setOpen}>
                <DrawerTrigger asChild>
                    <Button className="w-full sm:w-auto" variant="secondary">
                        <MapPinPlusIcon className="h-6 w-6" weight="bold" />
                        Create Route
                    </Button>
                </DrawerTrigger>
                <DrawerContent className="max-h-[90vh]">
                    <DrawerHeader className="pb-4 border-b text-left">
                        <DrawerTitle className="text-xl font-semibold">Create Route</DrawerTitle>
                        <DrawerDescription className="text-sm text-muted-foreground mt-1">
                            Fill in the route details and schedule information below.
                        </DrawerDescription>
                    </DrawerHeader>
                    <div className="overflow-y-auto">
                        <CreateRouteForm
                            {...formProps}
                            FooterWrapper={({ children }) => (
                                <DrawerFooter className="pt-4 pb-0 border-t flex-row justify-end px-0">
                                    {children}
                                </DrawerFooter>
                            )}
                        />
                    </div>
                </DrawerContent>
            </Drawer>
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
