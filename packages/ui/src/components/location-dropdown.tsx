"use client"

import { cn } from "../lib/utils"
import { Loader2 } from "lucide-react"

export type LocationSuggestion = {
    placeId: string
    title: string
    label: string
}

export interface LocationDropdownProps {
    onSelect: (location: LocationSuggestion) => void
    visible: boolean
    highlightedIndex?: number
    suggestions?: LocationSuggestion[]
    isLoading?: boolean
    query?: string
    className?: string
}

export function LocationDropdown({
    onSelect,
    visible,
    highlightedIndex = -1,
    suggestions = [],
    isLoading = false,
    query = "",
    className,
}: LocationDropdownProps) {

    if (!visible) return null

    return (
        <div
            role="listbox"
            className={cn(
                "absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg z-40 overflow-hidden",
                className
            )}
        >
            {isLoading && (
                <div className="flex items-center justify-center  gap-2 py-4 text-sm text-neutral-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading results...</span>
                </div>
            )}

            {!isLoading && suggestions.length === 0 && query.length > 0 && (
                <div className="py-4 text-sm text-neutral-500 text-center">
                    No locations found
                </div>
            )}

            {!isLoading &&
                suggestions.map((loc, idx) => (
                    <button
                        key={loc.placeId}
                        type="button"
                        role="option"
                        aria-selected={idx === highlightedIndex}
                        onClick={() => onSelect(loc)}
                        className={cn(
                            "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-neutral-100 last:border-b-0 cursor-pointer",
                            idx === highlightedIndex
                                ? "bg-neutral-100"
                                : "hover:bg-neutral-50"
                        )}
                    >
                        <div className="flex-1 min-w-0">
                            <span className="text-sm font-semibold text-neutral-900">
                                {loc.title}
                            </span>

                            {loc.label && (
                                <p className="text-xs text-neutral-500 mt-0.5">
                                    {loc.label}
                                </p>
                            )}
                        </div>
                    </button>
                ))}
        </div>
    )
}