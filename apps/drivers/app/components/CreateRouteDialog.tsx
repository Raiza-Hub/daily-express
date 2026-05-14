"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routeSchema, TRoute } from "@repo/types/index";
import { Button } from "@repo/ui/components/button";
import { MapPinPlusIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { CreateRouteForm } from "./route/CreateRouteForm";
import { ResponsiveModal } from "@repo/ui/ResponsiveModal";
import {
  applyApiFieldErrors,
  getApiErrorMessage,
  useCreateRoute,
} from "@repo/api";
import { useRouteFormUi } from "./route/useRouteFormUi";
import { posthogEvents } from "~/lib/posthog-events";
import { usePostHog } from "posthog-js/react";
import { useRouter, usePathname } from "next/navigation";

const CreateRouteDialog = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const ui = useRouteFormUi();
  const posthog = usePostHog();

  const { handleSubmit, control, reset, setError } = useForm<TRoute>({
    resolver: zodResolver(routeSchema),
    defaultValues: {
      departureCity: {
        title: "",
        locality: "",
        label: "",
      },
      arrivalCity: {
        title: "",
        locality: "",
        label: "",
      },
      vehicleType: "car",
      seatNumber: 1,
      price: 0,
      departureTime: new Date(),
      estimatedArrivalTime: new Date(Date.now() + 60 * 60 * 1000),
      meetingPoint: "",
    },
  });
  const createRoute = useCreateRoute({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_route_created_succeeded);
      if (pathname === "/routes") {
        handleClose();
      } else {
        router.push("/routes");
      }
    },
    onError: (error: Error) => {
      applyApiFieldErrors<keyof TRoute>(error, setError, {
        pickup_location_title: "departureCity",
        pickup_location_locality: "departureCity",
        pickup_location_label: "departureCity",
        dropoff_location_title: "arrivalCity",
        dropoff_location_locality: "arrivalCity",
        dropoff_location_label: "arrivalCity",
        meeting_point: "meetingPoint",
        availableSeats: "seatNumber",
        departure_time: "departureTime",
        arrival_time: "estimatedArrivalTime",
      });
      posthog.captureException(error, { action: "driver_route_create_failed" });
      setCreateError(getApiErrorMessage(error, "Failed to create route"));
    },
  });

  const handleClose = () => {
    setOpen(false);
    reset();
    ui.reset();
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

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          handleClose();
        } else {
          posthog.capture(posthogEvents.driver_route_created_succeeded, {
            action: "started",
          });
          setOpen(true);

          const now = new Date();
          reset({
            departureCity: {
              title: "",
              locality: "",
              label: "",
            },
            arrivalCity: {
              title: "",
              locality: "",
              label: "",
            },
            vehicleType: "car",
            seatNumber: 1,
            price: 0,
            departureTime: now,
            estimatedArrivalTime: new Date(now.getTime() + 60 * 60 * 1000),
            meetingPoint: "",
          });
        }
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
        control={control}
        handleSubmit={handleSubmit}
        isSubmitting={createRoute.isPending}
        onSubmit={onSubmit}
        onCancel={handleClose}
        ui={ui}
        error={createError}
        FooterWrapper={({ children }) => (
          <div className="pt-4 pb-4 border-t flex justify-end gap-2">
            {children}
          </div>
        )}
      />
    </ResponsiveModal>
  );
};

export default CreateRouteDialog;
