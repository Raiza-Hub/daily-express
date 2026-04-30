import { domAnimation, LazyMotion, m } from "framer-motion";
import { CalendarTwin } from "./CalendarTwin";

const MobileCalendarSheet = ({
    value,
    mobileRef,
    onClose,
    onSelect,
}: {
    value: Date;
    mobileRef: React.RefObject<HTMLDivElement | null>;
    onClose: () => void;
    onSelect: (date: Date) => void;
}) => {
    return (
        <div ref={mobileRef} className="md:hidden fixed inset-0 z-50 flex flex-col">
            <LazyMotion features={domAnimation}>
                <m.div
                    key="calendar-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: "easeInOut" }}
                    className="absolute inset-0 bg-black/40"
                    onClick={onClose}
                />

                <m.div
                    key="calendar-sheet"
                    initial={{ y: "100%" }}
                    animate={{ y: 0 }}
                    exit={{ y: "100%" }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    className="relative mt-auto bg-white rounded-t-2xl p-4 flex flex-col gap-4 max-h-[90vh] overflow-y-auto"
                >
                    <div className="flex items-center justify-between">
                        <span className="text-base font-semibold text-neutral-900">
                            Select departure date
                        </span>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-sm text-neutral-500 hover:text-neutral-800 transition cursor-pointer"
                        >
                            Close
                        </button>
                    </div>

                    <CalendarTwin value={value} onChange={onSelect} />
                </m.div>
            </LazyMotion>
        </div>
    );
}

export default MobileCalendarSheet;
