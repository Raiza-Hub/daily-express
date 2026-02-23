"use client"

import { cn } from "../lib/utils"

export type Location = {
    city: string
    airport: string
    code: string
    country: string
}

export const DEFAULT_LOCATIONS: Location[] = [
    { city: "Lagos", airport: "Murtala Muhammed International Airport", code: "LOS", country: "Nigeria" },
    { city: "Frankfurt", airport: "Frankfurt Airport", code: "FRA", country: "Germany" },
    { city: "London", airport: "Heathrow Airport", code: "LHR", country: "United Kingdom" },
    { city: "Abuja", airport: "Nnamdi Azikiwe International Airport", code: "ABV", country: "Nigeria" },
    { city: "New York", airport: "John F. Kennedy International Airport", code: "JFK", country: "United States" },
    { city: "Dubai", airport: "Dubai International Airport", code: "DXB", country: "United Arab Emirates" },
    { city: "Paris", airport: "Charles de Gaulle Airport", code: "CDG", country: "France" },
]

export function filterLocations(query: string, locations: Location[] = DEFAULT_LOCATIONS): Location[] {
    return locations.filter(
        (loc) =>
            loc.city.toLowerCase().includes(query.toLowerCase()) ||
            loc.code.toLowerCase().includes(query.toLowerCase()) ||
            loc.country.toLowerCase().includes(query.toLowerCase())
    )
}

export interface LocationDropdownProps {
    query: string
    onSelect: (location: Location) => void
    visible: boolean
    highlightedIndex?: number
    locations?: Location[]
    className?: string
}

export function LocationDropdown({
    query,
    onSelect,
    visible,
    highlightedIndex = -1,
    locations = DEFAULT_LOCATIONS,
    className,
}: LocationDropdownProps) {
    if (!visible || !query) return null
    const filtered = filterLocations(query, locations)
    if (!filtered.length) return null

    return (
        <div
            className={cn(
                "absolute top-full left-0 right-0 mt-2 bg-white border border-neutral-200 rounded-xl shadow-lg z-50 overflow-hidden",
                className
            )}
        >
            {filtered.map((loc, idx) => (
                <button
                    key={loc.code}
                    type="button"
                    onClick={() => onSelect(loc)}
                    className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 text-left",
                        idx === highlightedIndex ? "bg-neutral-100" : "hover:bg-neutral-50"
                    )}
                >
                    <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-neutral-900">
                            {loc.city}, {loc.country}
                        </span>
                        <p className="text-xs text-neutral-400 truncate">
                            {loc.airport}
                        </p>
                    </div>
                    <span className="text-sm font-semibold text-neutral-900 shrink-0">
                        {loc.code}
                    </span>
                </button>
            ))}
        </div>
    )
}
