"use client";

import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, domAnimation, LazyMotion, m } from "framer-motion";
import { FadersIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { useQueryState } from "nuqs";
import type { Route } from "@shared/types";
import ActiveCountClearButton from "../ActiveCountClearButton";
import FilterOptions from "../FilterOptions";
import { searchParams } from "~/lib/type";

const VEHICLE_TYPE_OPTIONS = [
  { label: "Car", value: "car" },
  { label: "Bus", value: "bus" },
  { label: "Luxury Car", value: "luxury_car" },
];

interface TripFilterProps {
  routes: Route[] | undefined;
  onApplyFilters?: () => void;
}

const TripFilter = ({ routes, onApplyFilters }: TripFilterProps) => {
  const [vehicleType, setVehicleType] = useQueryState(
    "vehicleType",
    searchParams.vehicleType.withOptions({ history: "replace" }),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileDraft, setMobileDraft] = useState<string[]>([]);

  const currentVehicleTypes = vehicleType || [];

  const handleVehicleTypeToggle = (value: string, isMobile = false) => {
    const source = isMobile ? mobileDraft : currentVehicleTypes;
    const nextVehicleTypes = source.includes(value)
      ? source.filter((vehicle) => vehicle !== value)
      : [...source, value];

    if (isMobile) {
      setMobileDraft(nextVehicleTypes);
    } else {
      void setVehicleType(
        nextVehicleTypes.length > 0 ? nextVehicleTypes : null,
      );
    }
  };

  const applyMobileFilters = () => {
    void setVehicleType(mobileDraft.length > 0 ? mobileDraft : null);
    setDrawerOpen(false);
    onApplyFilters?.();
  };

  const openDrawer = () => {
    setMobileDraft(currentVehicleTypes);
    setDrawerOpen(true);
  };

  const clearAllFilters = () => {
    void setVehicleType(null);
    setMobileDraft([]);
  };

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setDrawerOpen(false);
      }
    };

    // Run initially
    handleMediaChange(mql);

    mql.addEventListener("change", handleMediaChange);
    return () => mql.removeEventListener("change", handleMediaChange);
  }, []);

  useBodyScrollLock(drawerOpen);

  const activeCount = drawerOpen
    ? mobileDraft.length
    : currentVehicleTypes.length;

  const vehicleTypeData = useMemo(() => {
    const counts: Record<string, number> = {};
    if (routes) {
      routes.forEach((route) => {
        const vt = route.vehicleType?.toLowerCase();
        counts[vt] = (counts[vt] || 0) + 1;
      });
    }

    return VEHICLE_TYPE_OPTIONS.map(({ label, value }) => ({
      label,
      value,
      count: routes && routes.length > 0 ? counts[value] || 0 : undefined,
    }));
  }, [routes]);

  return (
    <>
      <div className="hidden lg:block w-80 bg-white py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg text-neutral-900 font-semibold">Filter by</h2>
          <ActiveCountClearButton
            activeCount={activeCount}
            onClear={clearAllFilters}
          />
        </div>

        <FilterOptions
          currentVehicleTypes={currentVehicleTypes}
          onToggle={(value) => handleVehicleTypeToggle(value, false)}
          vehicleTypeData={vehicleTypeData}
        />
      </div>

      {/* refactor into its own mobile trip filter with passed props */}
      {/* Mobile View */}
      <div className="block lg:hidden w-full">
        <Button
          variant="outline"
          className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 h-auto -mt-4 cursor-pointer shadow-none"
          onClick={openDrawer}
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          aria-controls="trip-filter-drawer"
        >
          <FadersIcon size={18} />
          Sort & Filter {activeCount > 0 && `(${activeCount})`}
        </Button>

        <AnimatePresence>
          {drawerOpen && (
            <LazyMotion features={domAnimation}>
              {/* Overlay */}
              <m.div
                key="trip-filter-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="fixed inset-0 z-50 bg-black/50"
                onClick={() => setDrawerOpen(false)}
              />

              {/* Full-screen panel */}
              <m.div
                key="trip-filter-panel"
                id="trip-filter-drawer"
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="fixed inset-0 z-50 flex flex-col bg-background overflow-hidden"
                role="dialog"
                aria-modal="true"
              >
                {/* Header */}
                <div className="flex items-start justify-between p-4 border-b shrink-0">
                  <div>
                    <h2 className="text-lg font-semibold">Filter by</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Refine your trip results.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    aria-label="Close"
                    className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <XIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-4 py-2">
                  <FilterOptions
                    currentVehicleTypes={mobileDraft}
                    onToggle={(value) => handleVehicleTypeToggle(value, true)}
                    vehicleTypeData={vehicleTypeData}
                  />
                </div>

                {/* Footer */}
                <div className="flex gap-4 p-4 border-t shrink-0">
                  <Button
                    variant="secondary"
                    className={`flex-1 ${mobileDraft.length === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={() => setMobileDraft([])}
                    disabled={mobileDraft.length === 0}
                  >
                    Clear all
                  </Button>
                  <Button
                    className="flex-1 bg-blue-600 hover:bg-blue-700 cursor-pointer"
                    onClick={applyMobileFilters}
                  >
                    Show results
                  </Button>
                </div>
              </m.div>
            </LazyMotion>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default TripFilter;
