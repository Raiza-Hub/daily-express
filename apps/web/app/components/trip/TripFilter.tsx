"use client";

import { useState, useEffect } from "react";
import { AnimatePresence, domAnimation, LazyMotion, m } from "framer-motion";
import { FadersIcon, XIcon } from "@phosphor-icons/react";
import { Button } from "@repo/ui/components/button";
import { useBodyScrollLock } from "@repo/ui/hooks/use-body-scroll-lock";
import { useQueryState, parseAsStringLiteral } from "nuqs";
import FilterOptions from "../FilterOptions";
import ActiveCountClearButton from "../ActiveCountClearButton";

const DEPARTURE_TIME_OPTIONS = [
  { label: "Morning", value: "morning" },
  { label: "Afternoon", value: "afternoon" },
] as const;

interface TripFilterProps {
  onApplyFilters?: () => void;
}

const TripFilter = ({ onApplyFilters }: TripFilterProps) => {
  const [departureTime, setDepartureTime] = useQueryState(
    "departureTime",
    parseAsStringLiteral(["morning", "afternoon"]).withOptions({ history: "replace" }),
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileDraft, setMobileDraft] = useState<"morning" | "afternoon" | null>(null);

  const handleTimeToggle = (value: "morning" | "afternoon", isMobile = false) => {
    const current = isMobile ? mobileDraft : departureTime;
    const next = current === value ? null : value;

    if (isMobile) {
      setMobileDraft(next);
    } else {
      void setDepartureTime(next);
    }
  };

  const applyMobileFilters = () => {
    void setDepartureTime(mobileDraft);
    setDrawerOpen(false);
    onApplyFilters?.();
  };

  const openDrawer = () => {
    setMobileDraft(departureTime);
    setDrawerOpen(true);
  };

  const clearAllFilters = () => {
    void setDepartureTime(null);
    setMobileDraft(null);
  };

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const handleMediaChange = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) {
        setDrawerOpen(false);
      }
    };

    handleMediaChange(mql);

    mql.addEventListener("change", handleMediaChange);
    return () => mql.removeEventListener("change", handleMediaChange);
  }, []);

  useBodyScrollLock(drawerOpen);

  const activeCount = drawerOpen
    ? (mobileDraft ? 1 : 0)
    : (departureTime ? 1 : 0);

  const departureTimeData = DEPARTURE_TIME_OPTIONS.map(({ label, value }) => ({
    label,
    value,
  }));

  return (
    <>
      <div className="hidden lg:block w-80 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg text-neutral-900 font-semibold">Filter by</h2>
          <ActiveCountClearButton
            activeCount={activeCount}
            onClear={clearAllFilters}
          />
        </div>

        <FilterOptions
          currentDepartureTime={departureTime}
          onToggle={(value) => handleTimeToggle(value as "morning" | "afternoon", false)}
          departureTimeData={departureTimeData}
        />
      </div>

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
                    <XIcon className="size-5" />
                  </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-4 py-2">
                  <FilterOptions
                    currentDepartureTime={mobileDraft}
                    onToggle={(value) => handleTimeToggle(value as "morning" | "afternoon", true)}
                    departureTimeData={departureTimeData}
                  />
                </div>

                {/* Footer */}
                <div className="flex gap-4 p-4 border-t shrink-0">
                  <Button
                    variant="secondary"
                    className={`flex-1 ${mobileDraft === null ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    onClick={() => setMobileDraft(null)}
                    disabled={mobileDraft === null}
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
