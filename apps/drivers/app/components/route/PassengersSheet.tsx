"use client";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@repo/ui/components/sheet";
import { Button } from "@repo/ui/components/button";
import { UsersThreeIcon } from "@phosphor-icons/react";

interface Passenger {
    firstName: string;
    lastName: string;
}

// Mock passenger data — replace with real data as needed
const passengers: Passenger[] = [
    { firstName: "Amara", lastName: "Okafor" },
    { firstName: "Chukwuemeka", lastName: "Nwosu" },
    { firstName: "Fatima", lastName: "Bello" },
    { firstName: "Oluwaseun", lastName: "Adeyemi" },
    { firstName: "Ngozi", lastName: "Eze" },
    { firstName: "Babatunde", lastName: "Adeola" },
];

interface PassengersSheetProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export default function PassengersSheet({ open, onOpenChange }: PassengersSheetProps) {
    const isControlled = open !== undefined;
    return (
        <Sheet open={isControlled ? open : undefined} onOpenChange={isControlled ? onOpenChange : undefined}>
            {!isControlled && (
                <SheetTrigger asChild>
                    <Button
                        variant="outline"
                        size="icon-lg"
                        className="rounded-lg border-slate-200 hover:bg-slate-100"
                    >
                        <UsersThreeIcon size={18} />
                    </Button>
                </SheetTrigger>
            )}

            <SheetContent className="w-full sm:max-w-[420px] overflow-y-aut">
                <SheetHeader className="pb-4 border-b px-6">
                    <SheetTitle className="text-xl font-semibold">Passengers</SheetTitle>
                    <SheetDescription className="text-sm text-muted-foreground mt-1">
                        List of passengers booked on this route.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-3 px-6">
                    {passengers.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-8">
                            No passengers booked yet.
                        </p>
                    ) : (
                        passengers.map((passenger, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100 transition-colors"
                            >
                                {/* Avatar */}
                                <div className="shrink-0 w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                                    {passenger.firstName[0]}{passenger.lastName[0]}
                                </div>

                                {/* Name */}
                                <div>
                                    <p className="text-sm font-medium text-slate-900">
                                        {passenger.firstName} {passenger.lastName}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
