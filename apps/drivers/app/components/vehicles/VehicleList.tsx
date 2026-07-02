"use client";

import { PencilIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import {
  useGetVehicles,
} from "@repo/api";
import type { Vehicle } from "@shared/types";
import { Button } from "@repo/ui/components/button";
import { useState } from "react";
import Loader from "../Loader";
import VehicleFormDialog from "./VehicleFormDialog";
import DeleteVehicleDialog from "./DeleteVehicleDialog";

const statusConfig: Record<string, { label: string; className: string }> = {
  available: { label: "Available", className: "bg-green-100 text-green-700" },
  in_use: { label: "In Use", className: "bg-yellow-100 text-yellow-700" },
};

const VehicleList = () => {
  const { data: vehicles, isLoading, isError, error } = useGetVehicles();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deletingVehicle, setDeletingVehicle] = useState<Vehicle | null>(null);

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl mx-auto flex items-center justify-center py-20">
        <Loader text="Loading vehicles..." />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-4 py-20">
        <p className="text-red-500 text-sm">
          {error instanceof Error ? error.message : "Failed to load vehicles"}
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6 py-4 border-b border-gray-100">
        <div>
          <h1 className="text-xl font-semibold mb-1">Vehicles</h1>
          <p className="text-sm text-muted-foreground">
            Manage your registered vehicles.
          </p>
        </div>
        <Button
          variant="secondary"
          className="cursor-pointer"
          onClick={() => setIsCreateOpen(true)}
        >
          <PlusIcon className="size-4 mr-1.5" />
          Add Vehicle
        </Button>
      </div>

      {(!vehicles || vehicles.length === 0) ? (
        <div className="flex flex-col items-center gap-2 py-12">
          <p className="text-muted-foreground">No vehicles added yet.</p>
          <Button
            variant="secondary"
            className="cursor-pointer"
            onClick={() => setIsCreateOpen(true)}
          >
            <PlusIcon className="size-4 mr-1.5" />
            Add your first vehicle
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {vehicles.map((vehicle) => {
            const status = statusConfig[vehicle.status] ?? {
              label: vehicle.status,
              className: "bg-neutral-100 text-neutral-700",
            };
            return (
              <div
                key={vehicle.id}
                className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">
                      {vehicle.make} {vehicle.model}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{vehicle.plateNumber}</span>
                    <span className="text-neutral-300">|</span>
                    <span>{vehicle.color}</span>
                    <span className="text-neutral-300">|</span>
                    <span>{vehicle.capacity} seats</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer"
                    onClick={() => setEditingVehicle(vehicle)}
                    aria-label={`Edit ${vehicle.plateNumber}`}
                  >
                    <PencilIcon className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="cursor-pointer text-red-500 hover:text-red-600"
                    onClick={() => setDeletingVehicle(vehicle)}
                    aria-label={`Delete ${vehicle.plateNumber}`}
                  >
                    <TrashIcon className="size-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <VehicleFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
      />

      {editingVehicle && (
        <VehicleFormDialog
          key={editingVehicle.id}
          vehicle={editingVehicle}
          open={!!editingVehicle}
          onOpenChange={(open) => {
            if (!open) setEditingVehicle(null);
          }}
        />
      )}

      {deletingVehicle && (
        <DeleteVehicleDialog
          vehicle={deletingVehicle}
          open={!!deletingVehicle}
          onOpenChange={(open) => {
            if (!open) setDeletingVehicle(null);
          }}
        />
      )}
    </div>
  );
};

export default VehicleList;
