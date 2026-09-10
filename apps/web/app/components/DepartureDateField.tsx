import dayjs from "dayjs";
import { cn } from "@repo/ui/lib/utils";
import { CalendarTwin } from "./CalendarTwin";


const DepartureDateField = ({
    value,
    isOpen,
    onToggle,
    onSelect,
    desktopRef,
    hideLabel = false,
    icon,
    className,
}: {
    value: Date;
    isOpen: boolean;
    onToggle: () => void;
    onSelect: (date: Date) => void;
    desktopRef: React.RefObject<HTMLDivElement | null>;
    hideLabel?: boolean;
    icon?: React.ReactNode;
    className?: string;
}) => {
    return (
        <div
            ref={desktopRef}
            className={cn(
                hideLabel
                    ? "relative flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5"
                    : "relative flex-[1.5] bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition",
                className,
            )}
        >
            <button
                type="button"
                onClick={onToggle}
                className="w-full text-left outline-none cursor-pointer"
            >
                {hideLabel ? null : (
                    <span className="text-xs text-neutral-400 block">Departure</span>
                )}
                <span className={cn("flex items-center gap-2 text-sm font-medium text-neutral-900", hideLabel ? "w-full" : "block")}>
                    {icon ? <span className="flex-none text-neutral-500">{icon}</span> : null}
                    <span className={hideLabel ? "line-clamp-1 sm:line-clamp-none min-w-0" : undefined}>
                        {dayjs(value).format("DD MMM YYYY")}
                    </span>
                </span>
            </button>

            {isOpen ? (
                <div className="absolute top-full right-0 mt-2 z-50 min-w-[600px] hidden md:block">
                    <CalendarTwin
                        value={value}
                        onChange={onSelect}
                        className="shadow-lg"
                    />
                </div>
            ) : null}
        </div>
    );
}

export default DepartureDateField;