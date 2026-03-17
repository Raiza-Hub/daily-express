import { useEffect, useMemo, useRef } from "react";
import debounce from "lodash.debounce";

export interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): ReturnType<T> | undefined;
    cancel(): void;
    flush(): ReturnType<T> | undefined;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
    callback: T,
    delay: number
): DebouncedFunction<T> {
    // Keep track of the latest callback to ensure we are always calling
    // the most current version of the handler without needing to reset the debounce timer
    const callbackRef = useRef(callback);

    callbackRef.current = callback;

    const debounced = useMemo(() => {

        const fn = (...args: Parameters<T>) => {
            return callbackRef.current(...args);
        };

        return debounce(fn, delay);

    }, [delay]);

    // cleanup
    useEffect(() => {
        return () => {
        debounced.cancel();
        };
    }, [debounced]);

    return debounced;
}
