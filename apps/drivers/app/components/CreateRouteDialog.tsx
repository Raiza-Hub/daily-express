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
import { useCreateRoute, useGetAllDriverRoutes } from "@repo/api";
import { toast } from "@repo/ui/components/sonner";

export default function CreateRouteDialog() {
  const [open, setOpen] = useState(false);
  const { refetch } = useGetAllDriverRoutes();

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

  const [departureSuggestions, setDepartureSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [isDepartureLoading, setIsDepartureLoading] = useState(false);

  const [arrivalCityQuery, setArrivalCityQuery] = useState("");
  const [showArrivalDropdown, setShowArrivalDropdown] = useState(false);
  const arrivalCityRef = useRef<HTMLDivElement>(null);
  const [arrivalSuggestions, setArrivalSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [isArrivalLoading, setIsArrivalLoading] = useState(false);

  const [priceDisplay, setPriceDisplay] = useState("");

  const createRoute = useCreateRoute({
    onSuccess: () => {
      toast.success("Route created successfully");
      refetch();
      handleClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create route");
      console.log(error);
    },
  });

  const fetchDepartureSuggestions = useDebouncedCallback(
    async (query: string) => {
      const res = await suggestLocations(query);
      setDepartureSuggestions(res);
      setIsDepartureLoading(false);
    },
    400,
  );

  const fetchArrivalSuggestions = useDebouncedCallback(
    async (query: string) => {
      const res = await suggestLocations(query);
      setArrivalSuggestions(res);
      setIsArrivalLoading(false);
    },
    400,
  );

  useClickOutside([departureCityRef, arrivalCityRef], () => {
    setShowDepartureDropdown(false);
    setShowArrivalDropdown(false);
  });

  const handleClose = () => {
    setOpen(false);
    reset();
    setDepartureCityQuery("");
    setArrivalCityQuery("");
    setPriceDisplay("");
  };

  const onSubmit = (data: TRoute) => {
    const transformedData = {
      pickup_location_title: data.departureCity.title,
      pickup_location_locality: data.departureCity.locality,
      pickup_location_label: data.departureCity.label,
      dropoff_location_title: data.arrivalCity.title,
      dropoff_location_locality: data.arrivalCity.locality,
      dropoff_location_label: data.arrivalCity.label,
      intermediate_stops_title: null,
      intermediate_stops_locality: null,
      intermediate_stops_label: null,
      vehicleType: data.vehicleType,
      meeting_point: data.meetingPoint,
      availableSeats: data.seatNumber,
      price: data.price,
      departure_time: data.departureTime,
      arrival_time: data.estimatedArrivalTime,
      status: "active" as const,
    };
    createRoute.mutate(transformedData);
  };

  const formProps = {
    control,
    handleSubmit,
    isSubmitting: createRoute.isPending,
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
    setArrivalSuggestions,
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(val) => {
        if (!val) handleClose();
        else setOpen(true);
      }}
      trigger={
        <Button className="w-full sm:w-auto cursor-pointer" variant="secondary">
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
