"use client";

import { useState } from "react";
import { CarIcon, EyeIcon, IdentificationCardIcon, Info, NotePencilIcon, TrashIcon, UserFocusIcon, UserListIcon } from "@phosphor-icons/react";
import EditRouteSheet from "./EditRouteSheet";
import PassengersSheet from "./PassengersSheet";
import PassengerStatusBar from "./PassengerStatusBar";
import { Button } from "@repo/ui/components/button";
const PlaneDots = () => (
    <div className="flex items-center gap-1 flex-1 mx-3">
        <div className="w-2 h-2 rounded-full bg-neutral-500 border-2 border-neutral-500" />
        <div className="flex-1 border-t-2 border-dotted border-neutral-400" />
        <div className="w-2 h-2 rounded-full bg-neutral-500 border-2 border-neutral-500" />
    </div>
);

interface RouteData {
    departureTime: string;
    departureCode: string;
    arrivalTime: string;
    arrivalCode: string;
}


const routes: RouteData[] = [
    {
        departureTime: "15:30pm",
        departureCode: "FUNNAB",
        arrivalTime: "09:43am",
        arrivalCode: "OSOHDI PARK",

    },
    {
        departureTime: "9:30am",
        departureCode: "LAGOS",
        arrivalTime: "10:40am",
        arrivalCode: "AGO-IWOYE",

    },
    {
        departureTime: "1:30pm",
        departureCode: "ABEOKUTA",
        arrivalTime: "4:44pm",
        arrivalCode: "IBADAN",
    },
];

// function ToggleSwitch({
//     checked,
//     onChange,
// }: {
//     checked: boolean;
//     onChange: (val: boolean) => void;
// }) {
//     return (
//         <button
//             type="button"
//             role="switch"
//             aria-checked={checked}
//             onClick={() => onChange(!checked)}
//             className={`
//         relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full
//         border-2 border-transparent transition-colors duration-200 ease-in-out
//         focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring
//         ${checked ? "bg-primary" : "bg-muted-foreground/30"}
//       `}
//         >
//             <span
//                 className={`
//           pointer-events-none inline-block h-4 w-4 rounded-full bg-white
//           shadow-lg ring-0 transition-transform duration-200 ease-in-out
//           ${checked ? "translate-x-4" : "translate-x-0"}
//         `}
//             />
//         </button>
//     );
// }

function RouteCardItem({ route }: { route: RouteData }) {
    const [routeActive, setRouteActive] = useState(true);

    return (
        <div
            className="group relative flex flex-col lg:flex-row items-stretch gap-6 rounded-xl bg-white p-6 border border-slate-200 transition-all duration-200"
        >
            {/* Left Section — Route Info */}
            <div className="flex-1 flex flex-col justify-center">
                {/* Top: Toggle Switch */}
                {/* <div className="flex items-center justify-between gap-3 mb-6">
                    <div className="flex items-center gap-2">
                        <ToggleSwitch checked={routeActive} onChange={setRouteActive} />
                        <span
                            className={`
                            text-xs font-semibold tracking-wide uppercase transition-colors
                            ${routeActive ? "text-slate-600" : "text-slate-400"}
                        `}
                        >
                            {routeActive ? "Active Route" : "Route Disabled"}
                        </span>
                    </div>

                    <div className="block sm:hidden">
                        <RouteCardActionMenu />
                    </div>
                </div> */}

                {/* Flight Times & Route */}
                <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-medium text-neutral-900 tracking-tight">
                            {route.departureTime}
                        </span>
                        <PlaneDots />
                        <span className="text-xl font-medium text-neutral-900 tracking-tight">
                            {route.arrivalTime}
                        </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        {route.departureCode} – {route.arrivalCode}
                    </p>
                </div>

            </div>

            {/* Right Section — Prices */}
            <div className="w-full lg:w-auto flex-1 flex items-center justify-between lg:justify-end gap-6">
                {/* Passenger Status */}
                <div className="w-full sm:w-auto sm:min-w-[260px]">
                    <PassengerStatusBar />
                </div>

                {/* Divider */}
                <div className="hidden lg:block h-12 w-px bg-slate-200" />

                {/* Action Buttons */}
                <div className="hidden sm:flex items-center gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    {/* Edit - Primary */}


                    <EditRouteSheet
                        defaultValues={{
                            departureCity: { title: "Lagos", locality: "LOS", label: "Ojota Motor Park" },
                            arrivalCity: { title: "Abuja", locality: "ABV", label: "Nnamdi Azikiwe International Airport" },
                            vehicleType: "car",
                            seatNumber: 8,
                            price: 900000,
                            departureTime: new Date('2026-02-10T15:30:00'),
                            estimatedArrivalTime: new Date('2026-02-11T09:43:00'),
                        }}
                    />

                    {/* Passengers */}
                    <PassengersSheet />

                    {/* Delete - Destructive */}
                    <Button
                        variant="outline"
                        size="icon-lg"
                        className="rounded-lg border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
                    >
                        <TrashIcon size={18} />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default function RouteCard() {
    return (
        <div className="flex flex-col gap-4">
            {routes.map((route, index) => (
                <RouteCardItem key={index} route={route} />
            ))}
        </div>
    );
}
