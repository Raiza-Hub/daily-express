"use client";

import {
  getApiErrorMessage,
  useDeleteVehicle,
} from "@repo/api";
import type { Vehicle } from "@shared/types";
import { ResponsiveModal } from "@repo/ui/ResponsiveModal";
import { Button } from "@repo/ui/components/button";
import { usePostHog } from "posthog-js/react";
import { useState } from "react";
import { posthogEvents } from "~/lib/posthog-events";

interface DeleteVehicleDialogProps {
  vehicle: Vehicle;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DeleteVehicleDialog({
  vehicle,
  open,
  onOpenChange,
}: DeleteVehicleDialogProps) {
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const posthog = usePostHog();

  const { mutate: deleteVehicle, isPending } = useDeleteVehicle({
    onSuccess: () => {
      posthog.capture(posthogEvents.driver_vehicle_deleted_succeeded);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      posthog.captureException(error, {
        action: "delete_vehicle_failed",
      });
      setDeleteError(getApiErrorMessage(error, "Failed to delete vehicle"));
    },
  });

  const handleDelete = () => {
    setDeleteError(null);
    deleteVehicle(vehicle.id);
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={(val) => {
        if (!val) {
          setDeleteError(null);
          onOpenChange(false);
        }
      }}
      title="Delete Vehicle"
    >
      <div className="space-y-6 py-4 px-4 sm:p-0">
        <p className="text-sm text-muted-foreground">
          Are you sure you want to delete{" "}
          <span className="font-semibold text-foreground">
            {vehicle.make} {vehicle.model}
          </span>{" "}
          ({vehicle.plateNumber})? This action cannot be undone.
        </p>

        {deleteError && (
          <p className="text-sm text-red-500">{deleteError}</p>
        )}

        <div className="flex justify-end gap-2 pb-4">
          <Button
            type="button"
            variant="secondary"
            className="cursor-pointer"
            onClick={() => {
              setDeleteError(null);
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="submit"
            className="cursor-pointer bg-red-600 hover:bg-red-700"
            disabled={isPending}
            onClick={handleDelete}
          >
            {isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </div>
    </ResponsiveModal>
  );
}
