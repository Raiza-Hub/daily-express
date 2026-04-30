import dayjs from "dayjs";
import { CalendarTwin } from "./CalendarTwin";


const DepartureDateField = ({
    value,
    isOpen,
    onToggle,
    onSelect,
    desktopRef,
}: {
    value: Date;
    isOpen: boolean;
    onToggle: () => void;
    onSelect: (date: Date) => void;
    desktopRef: React.RefObject<HTMLDivElement | null>;
}) => {
    return (
        <div
            ref={desktopRef}
            className="relative flex-[1.5] bg-white border border-neutral-200 rounded-2xl px-4 py-2 flex flex-col justify-center focus-within:ring-2 focus-within:ring-blue-500 transition"
        >
            <button
                type="button"
                onClick={onToggle}
                className="w-full text-left outline-none cursor-pointer"
            >
                <span className="text-xs text-neutral-400 block">Departure</span>
                <span className="text-sm font-medium text-neutral-900">
                    {dayjs(value).format("DD MMM YYYY")}
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