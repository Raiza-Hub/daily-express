"use client"
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FadersIcon, XIcon } from "@phosphor-icons/react";
import { CheckboxItem } from "./CheckboxItem";
import { FilterSection } from "./FilterSection";
import { Button } from "@repo/ui/components/button";

const filterData = {
    vehicleType: [
        { label: "Car", count: 3, },
        { label: "Bus", count: 18, },
        { label: "Luxury Car", count: 18, },
    ],
};

export default function TripFilter() {
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const [drawerOpen, setDrawerOpen] = useState(false);

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

    const toggle = (key: string) =>
        setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

    const activeCount = Object.values(checked).filter(Boolean).length;

    const ActiveCountClear = () => activeCount > 0 && (
        <button
            onClick={() => setChecked({})}
            className="text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 cursor-pointer"
        >
            Clear all filters ({activeCount})
        </button>
    );

    const FilterOptions = () => (
        <div className="divide-y divide-slate-100">
            {/* Stops */}
            <FilterSection title="Vehicle Type">
                {filterData.vehicleType.map((item) => (
                    <CheckboxItem
                        key={item.label}
                        {...item}
                        checked={!!checked[`stop-${item.label}`]}
                        onChange={() => toggle(`stop-${item.label}`)}
                    />
                ))}
            </FilterSection>
        </div>
    );

    return (
        <>
            {/* Desktop View */}
            <div className="hidden lg:block w-80 bg-white py-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg text-neutral-900 font-semibold">Filter by</h2>
                    <ActiveCountClear />
                </div>

                <FilterOptions />
            </div>

            {/* Mobile View */}
            <div className="block lg:hidden w-full">
                <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 h-auto -mt-4 cursor-pointer shadow-none"
                    onClick={() => setDrawerOpen(true)}
                    aria-haspopup="dialog"
                    aria-expanded={drawerOpen}
                    aria-controls="trip-filter-drawer"
                >
                    <FadersIcon size={18} />
                    Sort & Filter {activeCount > 0 && `(${activeCount})`}
                </Button>

                <AnimatePresence>
                    {drawerOpen && (
                        <>
                            {/* Overlay */}
                            <motion.div
                                key="trip-filter-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.5, ease: "easeInOut" }}
                                className="fixed inset-0 z-50 bg-black/50"
                                onClick={() => setDrawerOpen(false)}
                            />

                            {/* Full-screen panel */}
                            <motion.div
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
                                        <p className="text-sm text-muted-foreground mt-1">Refine your trip results.</p>
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
                                    <FilterOptions />
                                </div>

                                {/* Footer */}
                                <div className="flex gap-4 p-4 border-t shrink-0">
                                    <Button
                                        variant="secondary"
                                        className={`flex-1 ${activeCount === 0 ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                        onClick={() => activeCount > 0 && setChecked({})}
                                        disabled={activeCount === 0}
                                    >
                                        Clear all
                                    </Button>
                                    <Button
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 cursor-pointer"
                                        onClick={() => setDrawerOpen(false)}
                                    >
                                        Show results
                                    </Button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}