"use client";

import { useState } from "react";
import dayjs from "dayjs";
import {
  CalendarDotsIcon,
  ClockIcon,
  NotePencilIcon,
  SeatIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useDeleteRoute } from "@repo/api";
import { Badge } from "@repo/ui/components/badge";
import { Button } from "@repo/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/components/card";
import { formatPrice, getDuration } from "@repo/ui/lib/utils";
import { toast } from "@repo/ui/components/sonner";
import {
  DriverRoute,
  formatRouteStatus,
  statusStyles,
  vehicleMeta,
} from "./driverRoutesShared";
import EditRouteSheet from "./EditRouteSheet";

interface DriverRouteDetailsCardProps {
  route: DriverRoute;
  onRouteChanged: () => void;
}

export default function DriverRouteDetailsCard({
  route,
  onRouteChanged,
}: DriverRouteDetailsCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const departure = new Date(route.departure_time);
  const arrival = new Date(route.arrival_time);
  const vehicle = vehicleMeta[route.vehicleType]!;
  const VehicleIcon = vehicle.Icon;
  const duration = getDuration(departure, arrival);
  const deleteRoute = useDeleteRoute({
    onSuccess: () => {
      toast.success("Route deleted successfully");
      onRouteChanged();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete route");
    },
  });

  const defaultValues = {
    departureCity: {
      title: route.pickup_location_title,
      locality: route.pickup_location_locality,
      label: route.pickup_location_label,
    },
    arrivalCity: {
      title: route.dropoff_location_title,
      locality: route.dropoff_location_locality,
      label: route.dropoff_location_label,
    },
    vehicleType: route.vehicleType,
    seatNumber: route.availableSeats,
    price: route.price,
    departureTime: new Date(route.departure_time),
    estimatedArrivalTime: new Date(route.arrival_time),
    meetingPoint: route.meeting_point,
  } as const;

  const handleDelete = () => {
    if (!window.confirm("Delete this route? This action cannot be undone.")) {
      return;
    }
    deleteRoute.mutate(route.id);
  };

  return (
    <Card className="gap-0 border-slate-200 shadow-none">
      <CardHeader className="gap-4 border-b border-slate-100">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1.5">
            <CardTitle className="text-xl text-slate-900">
              {route.pickup_location_title} to {route.dropoff_location_title}
            </CardTitle>
            <CardDescription className="text-sm">
              {route.pickup_location_locality} to{" "}
              {route.dropoff_location_locality}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={statusStyles[route.status]}>
              {formatRouteStatus(route.status)}
            </Badge>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={() => setEditOpen(true)}
            >
              <NotePencilIcon size={16} />
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              disabled={deleteRoute.isPending}
              onClick={handleDelete}
            >
              <TrashIcon size={16} />
              {deleteRoute.isPending ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-4 py-6 md:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDotsIcon size={16} />
            Schedule
          </div>
          <p className="font-medium text-slate-900">
            {dayjs(departure).format("h:mm A")} to{" "}
            {dayjs(arrival).format("h:mm A")}
          </p>
          <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <ClockIcon size={14} />
            {duration}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
            <SeatIcon size={16} />
            Capacity
          </div>
          <p className="font-medium text-slate-900">
            {route.availableSeats} seats
          </p>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <VehicleIcon size={16} />
            {vehicle?.label}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
          <div className="mb-2 text-sm text-muted-foreground">Fare</div>
          <p className="font-medium text-slate-900">
            {formatPrice(route.price)}
          </p>
        </div>
      </CardContent>
      <EditRouteSheet
        routeId={route.id}
        defaultValues={defaultValues}
        open={editOpen}
        onOpenChange={setEditOpen}
        onSuccess={onRouteChanged}
      />
    </Card>
  );
}
