import { cn } from "@repo/ui/lib/utils";
import type { ComponentProps } from "react";

export const PlaneDots = ({ className, ...props }: ComponentProps<"div">) => (
    <div
        className={cn("flex items-center gap-1 flex-1 mx-3 sm:min-w-60", className)}
        {...props}
    >
        <div className="w-2 h-2 rounded-full bg-neutral-500 border-2 border-neutral-500" />
        <div className="flex-1 border-t-2 border-dotted border-neutral-400" />
        <div className="w-2 h-2 rounded-full bg-neutral-500 border-2 border-neutral-500" />
    </div>
);