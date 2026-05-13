"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { routeSchema, TRoute } from "@repo/types/index";
import { useUpdateRoute } from "@repo/api";
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
import { NotePencilIcon } from "@phosphor-icons/react";
import {
  RouteInformationSection,
  RoutePricingSection,
  RouteScheduleSection,
} from "./RouteFormSections";
import { useRouteFormUi } from "./useRouteFormUi";
import { usePostHog } from "posthog-js/react";
import { posthogEvents } from "~/lib/posthog-events";

interface EditRouteSheetProps {
  routeId: string;
  defaultValues: Partial<TRoute>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
  trigger?: React.ReactNode;
}

export default function EditRouteSheet({
  routeId,
  defaultValues,
  open,
  onOpenChange,
  onSuccess,
  trigger,
}: EditRouteSheetProps) {
  const isControlled = open !== undefined;
  const ui = useRouteFormUi(defaultValues);
  const posthog = usePostHog();
  const uiRef = useRef(ui);
  uiRef.current = ui;
  const [routeError, setRouteError] = useState<string | null>(null);

  const {
    handleSubmit,
    control,
    reset,
  } = useForm<TRoute>({
    resolver: zodResolver(routeSchema),
    defaultValues: defaultValues,
  });
  const updateRoute = useUpdateRoute({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_route_updated_succeeded);
      onSuccess?.();
      onOpenChange?.(false);
    },
    onError: (err) => {
      setRouteError(err.message);
      posthog.captureException(new Error(err.message), {
        action: "driver_route_update_failed",
      });
    },
  });

  // Stable serialized key so the effect only fires when values actually change
  const defaultValuesKey = useMemo(
    () => JSON.stringify(defaultValues),
    [defaultValues],
  );

  useEffect(() => {
    reset(defaultValues);
    uiRef.current.reset(defaultValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultValuesKey, reset]);

  const onSubmit = (data: TRoute) => {
    updateRoute.mutate({
      id: routeId,
      data: {
        pickup_location_title: data.departureCity.title,
        pickup_location_locality: data.departureCity.locality,
        pickup_location_label: data.departureCity.label,
        dropoff_location_title: data.arrivalCity.title,
        dropoff_location_locality: data.arrivalCity.locality,
        dropoff_location_label: data.arrivalCity.label,
        intermediate_stops_title: null,
        intermediate_stops_locality: null,
        intermediate_stops_label: null,
        meeting_point: data.meetingPoint,
        vehicleType: data.vehicleType,
        availableSeats: data.seatNumber,
        price: data.price,
        departure_time: data.departureTime,
        arrival_time: data.estimatedArrivalTime,
      },
    });
  };

  return (
    <Sheet
      open={isControlled ? open : undefined}
      onOpenChange={isControlled ? onOpenChange : undefined}
    >
      {!isControlled && (
        <SheetTrigger
          className="group flex items-center p-2 cursor-pointer"
          asChild
        >
          {trigger ?? (
            <Button
              size="icon-lg"
              className="rounded-lg bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
            >
              <NotePencilIcon size={18} />
            </Button>
          )}
        </SheetTrigger>
      )}
      <SheetContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-full sm:max-w-[540px] overflow-y-auto"
      >
        <SheetHeader className="pb-4 border-b px-6">
          <SheetTitle className="text-xl font-semibold">Edit Route</SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground mt-1">
            Update the route details and schedule information below.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8 py-6 px-6">
          <RouteInformationSection control={control} ui={ui} />
          <RoutePricingSection control={control} ui={ui} />
          <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
            New price applies only to future bookings.
          </p>
          <RouteScheduleSection control={control} />

          <SheetFooter className="pt-4 pb-0">
            {routeError && (
              <p className="px-1 pb-2 inline-flex justify-center text-sm text-red-500">
                {routeError}
              </p>
            )}
            <Button
              type="submit"
              disabled={updateRoute.isPending}
              className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 cursor-pointer"
            >
              Save Changes
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
