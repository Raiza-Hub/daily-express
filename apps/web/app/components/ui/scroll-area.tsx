"use client";

import * as React from "react";

const ScrollArea = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(
    ({ className = "", ...props }, ref) => (
        <div
            ref={ref}
            className={`relative overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent ${className}`}
            {...props}
        />
    ),
);
ScrollArea.displayName = "ScrollArea";

export { ScrollArea };