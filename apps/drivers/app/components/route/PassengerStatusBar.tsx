import { Label } from "@repo/ui/components/label";
import { Slider } from "@repo/ui/components/slider";
import { cn } from "@repo/ui/lib/utils";

interface PassengerStatusBarProps {
  bookedSeats: number;
  capacity: number;
}

const PassengerStatusBar = ({
  bookedSeats,
  capacity,
}: PassengerStatusBarProps) => {
  const skipInterval = 2;
  const ticks = [...Array(capacity + 1)].map((_, i) => i);

  return (
    <div className="*:not-first:mt-4">
      <Label className="text-sm">
        Passengers - {bookedSeats}
      </Label>
      <div>
        <Slider
          aria-label="Slider with ticks"
          value={[bookedSeats]}
          max={capacity}
          disabled
          className="[&_[data-slot=slider-range]]:bg-blue-600 [&_[data-slot=slider-track]]:bg-slate-200"
        />
        <span
          aria-hidden="true"
          className="mt-3 flex w-full items-center justify-between gap-1 px-2.5 font-medium text-muted-foreground text-xs"
        >
          {ticks.map((tickValue, i) => (
            <span
              className="flex w-0 flex-col items-center justify-center gap-2"
              key={`tick-${tickValue}`}
            >
              <span
                className={cn(
                  "h-1 w-px bg-muted-foreground/70",
                  i % skipInterval !== 0 && "h-0.5",
                )}
              />
              <span className={cn(i % skipInterval !== 0 && "opacity-0")}>
                {tickValue}
              </span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};

export default PassengerStatusBar;
