"use client"
import { useState, useEffect } from "react";

const filterData = {
    vehicleType: [
        { label: "Car", count: 3, },
        { label: "Bus", count: 18, },
        { label: "Luxury Car", count: 18, },
    ],
};

import { Checkbox } from "@repo/ui/components/checkbox";
import { Button } from "@repo/ui/components/button";
import { Faders } from "@phosphor-icons/react";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@repo/ui/components/drawer";

interface FilterItem {
    label: string;
    count?: number;
    price?: string;
}

interface CheckboxItemProps extends FilterItem {
    checked: boolean;
    onChange: () => void;
}

function CheckboxItem({ label, count, price, checked, onChange }: CheckboxItemProps) {
    return (
        <label
            className="flex items-center justify-between py-2 cursor-pointer group"
        >
            <div className="flex items-center gap-3">
                <Checkbox
                    checked={checked}
                    onCheckedChange={onChange}
                    className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                />
                <span className=" text-sm group-hover:text-slate-900 transition-colors">
                    {label}
                    {count !== undefined && (
                        <span className=" ml-1">({count})</span>
                    )}
                </span>
            </div>
        </label>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="pb-5 mb-1">
            <div className="flex justify-between items-center mb-3">
                <h3
                    className="text-sm font-medium"
                >
                    {title}
                </h3>
            </div>
            <div className="">{children}</div>
        </div>
    );
}

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
            <Section title="Vehicle Type">
                {filterData.vehicleType.map((item) => (
                    <CheckboxItem
                        key={item.label}
                        {...item}
                        checked={!!checked[`stop-${item.label}`]}
                        onChange={() => toggle(`stop-${item.label}`)}
                    />
                ))}
            </Section>
        </div>
    );

    return (
        <>
            {/* Desktop View */}
            <div className="hidden lg:block w-80 bg-white p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg text-neutral-900 font-semibold">Filter by</h2>
                    <ActiveCountClear />
                </div>

                <FilterOptions />
            </div>

            {/* Mobile View */}
            <div className="block lg:hidden w-full">
                <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                    <DrawerTrigger asChild>
                        <Button variant="outline" className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 h-auto -mt-4 cursor-pointer shadow-none">
                            <Faders size={18} />
                            Sort & Filter {activeCount > 0 && `(${activeCount})`}
                        </Button>
                    </DrawerTrigger>
                    <DrawerContent>
                        <DrawerHeader className="text-left">
                            <DrawerTitle>Filter by</DrawerTitle>
                            <DrawerDescription>
                                Refine your trip results.
                            </DrawerDescription>
                        </DrawerHeader>

                        <div className="px-4 py-2 overflow-y-auto max-h-[60vh]">
                            <FilterOptions />
                        </div>

                        <DrawerFooter className="flex-row justify-between gap-4 pt-4">
                            {activeCount > 0 ? (
                                <Button variant="secondary" className="flex-1 cursor-pointer" onClick={() => setChecked({})}>
                                    Clear all
                                </Button>
                            ) : (
                                <Button variant="secondary" className="flex-1 opacity-50 cursor-not-allowed">
                                    Clear all
                                </Button>
                            )}
                            <DrawerClose asChild>
                                <Button className="flex-1 bg-blue-600 hover:bg-blue-700 cursor-pointer">Show results</Button>
                            </DrawerClose>
                        </DrawerFooter>
                    </DrawerContent>
                </Drawer>
            </div>
        </>
    );
}