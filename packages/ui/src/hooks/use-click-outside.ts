import { RefObject, useEffect, useRef } from "react";

export function useClickOutside<T extends HTMLElement = HTMLElement>(
  ref: RefObject<T | null> | RefObject<T | null>[],
  handler: (event: MouseEvent | TouchEvent) => void
) {
  const handlerRef = useRef(handler);

  // always keep latest handler
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const refs = Array.isArray(ref) ? ref : [ref];

      const clickedOutside = refs.every((r) => {
        const el = r.current;
        if (!el) return false;
        return !el.contains(event.target as Node);
      });

      if (clickedOutside) {
        handlerRef.current(event);
      }
    };

    document.addEventListener("mousedown", listener);
    document.addEventListener("touchstart", listener);

    return () => {
      document.removeEventListener("mousedown", listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref]);
}