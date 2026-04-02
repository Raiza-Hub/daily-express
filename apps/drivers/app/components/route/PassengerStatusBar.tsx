import { Label } from "@repo/ui/components/label";
import { Slider } from "@repo/ui/components/slider";
import { cn } from "@repo/ui/lib/utils";

interface PassengerStatusBarProps {
  bookedSeats?: number;
  capacity?: number;
}

const PassengerStatusBar = ({
  bookedSeats = 0,
  capacity = 8,
}: PassengerStatusBarProps) => {
  const max = capacity;
  const skipInterval = 2;
  const ticks = [...Array(max + 1)].map((_, i) => i);

  return (
    <div className="*:not-first:mt-4">
      <Label className="text-sm">
        Passengers - {bookedSeats}/{max}
      </Label>
      <div>
        <Slider
          aria-label="Slider with ticks"
          value={[bookedSeats]}
          max={max}
          disabled
        />
        <span
          aria-hidden="true"
          className="mt-3 flex w-full items-center justify-between gap-1 px-2.5 font-medium text-muted-foreground text-xs"
        >
          {ticks.map((_, i) => (
            <span
              className="flex w-0 flex-col items-center justify-center gap-2"
              key={String(i)}
            >
              <span
                className={cn(
                  "h-1 w-px bg-muted-foreground/70",
                  i % skipInterval !== 0 && "h-0.5",
                )}
              />
              <span className={cn(i % skipInterval !== 0 && "opacity-0")}>
                {i}
              </span>
            </span>
          ))}
        </span>
      </div>
    </div>
  );
};

export default PassengerStatusBar;
