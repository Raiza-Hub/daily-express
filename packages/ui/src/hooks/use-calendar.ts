import { useRef, useState } from "react";


export function useCalendarState(initialDate: Date) {
  const [date, setDate] = useState(initialDate);
  const [isOpen, setIsOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  return {
    date,
    isOpen,
    desktopRef,
    mobileRef,
    toggle: () => setIsOpen((current) => !current),
    close: () => setIsOpen(false),
    select: (nextDate: Date) => {
      setDate(nextDate);
      setIsOpen(false);
    },
  };
}