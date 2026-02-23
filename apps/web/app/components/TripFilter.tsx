"use client"
import { useState } from "react";

const filterData = {
    vehicleType: [
        { label: "Car", count: 3,  },
        { label: "Bus", count: 18, },
        { label: "Luxury Car", count: 18, },
    ],
};

import { Checkbox } from "@repo/ui/components/checkbox";

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

    const toggle = (key: string) =>
        setChecked((prev) => ({ ...prev, [key]: !prev[key] }));

    const activeCount = Object.values(checked).filter(Boolean).length;

    return (
        <>
            <div className="w-80 bg-white p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-lg text-neutral-900 font-semibold">Filter by</h2>
                    {activeCount > 0 && (
                        <button
                            onClick={() => setChecked({})}
                            className="text-xs text-blue-600 font-semibold hover:text-blue-800 transition-colors px-2 py-1 rounded-lg hover:bg-blue-50 cursor-pointer"
                        >
                            Clear all filters ({activeCount})
                        </button>
                    )}
                </div>

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
            </div>
        </>
    );
}