"use client";

import { CaretDown } from "@phosphor-icons/react";
import { format } from "date-fns";
import { useRef, useState } from "react";
import type { DayButtonProps } from "react-day-picker";

import { Button } from "@repo/ui/components/button";
import { Calendar } from "@repo/ui/components/calendar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@repo/ui/components/collapsible";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { cn } from "@repo/ui/lib/utils";

export default function DriverCalendar({
  counts = {},
  onDateSelect,
}: {
  counts?: Record<string, number>;
  onDateSelect?: (date: Date | undefined) => void;
}) {
  const today = new Date();
  const [date, setDate] = useState<Date | undefined>(today);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const isDateDisabled = (date: Date) => {
    return !counts[format(date, "yyyy-MM-dd")];
  };

  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    setDate(d);
    onDateSelect?.(d);
    setOpen(false);
  };

  return (
    <Collapsible
      ref={containerRef}
      open={open}
      onOpenChange={setOpen}
      className="relative w-full md:w-fit max-w-full"
    >
      <CollapsibleTrigger asChild>
        <Button
          variant="outline"
          className="w-full min-w-[180px] justify-between"
        >
          {date ? format(date, "EEE, d MMM yyyy") : "Select date"}

          <CaretDown
            className={cn(
              "size-4 transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="absolute top-full right-0 md:left-auto z-50 mt-2 w-full md:w-fit">
        <div className="w-fit max-w-[calc(100vw-2rem)] overflow-x-auto rounded-md border bg-background shadow-lg">
          <Calendar
            className="w-fit p-2 [--cell-size:--spacing(10)]"
            classNames={{
              day_button: "size-10 md:size-12 !rounded-md",
              month:
                "relative first-of-type:before:hidden before:absolute before:inset-y-2 before:w-px before:bg-border before:-left-2 md:before:-left-4",
              months:
                "flex flex-row gap-4 md:gap-8 [&>.rdp-month:last-of-type]:hidden md:[&>.rdp-month:last-of-type]:block relative",
              today: "*:after:hidden",
              weekday: "w-10 md:w-12 text-xs font-medium",
            }}
            components={{
              DayButton: (props: DayButtonProps) => (
                <DayButton {...props} counts={counts} />
              ),
            }}
            disabled={isDateDisabled}
            mode="single"
            numberOfMonths={2}
            onSelect={handleSelect}
            pagedNavigation
            required
            selected={date}
            showOutsideDays={false}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function DayButton(
  props: DayButtonProps & { counts: Record<string, number> }
) {
  const { day, counts, modifiers, className, ...buttonProps } = props;
  const count = counts[format(day.date, "yyyy-MM-dd")];

  return (
    <button
      {...buttonProps}
      className={cn(
        className,
        "cursor-pointer transition-colors !rounded-md",
        !modifiers.selected &&
        !modifiers.disabled &&
        "hover:bg-accent hover:text-accent-foreground",
        modifiers.selected &&
        "bg-blue-600 text-white hover:bg-blue-600 hover:text-white",
        modifiers.disabled &&
        !modifiers.selected &&
        "text-muted-foreground line-through cursor-not-allowed"
      )}
    >
      <span className="flex flex-col items-center gap-0.5">
        {props.children}

        {count !== undefined && (
          <span
            className={cn(
              "text-[10px] font-medium",
              modifiers.selected
                ? "text-white/70"
                : "text-muted-foreground"
            )}
          >
            {count}
          </span>
        )}
      </span>
    </button>
  );
}