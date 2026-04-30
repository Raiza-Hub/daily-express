"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import type { TRoute } from "@repo/types";
import type { AWSPlaceDetails } from "@repo/types";
import type { LocationSuggestion } from "@repo/ui/components/location-dropdown";
import { useClickOutside } from "@repo/ui/hooks/use-click-outside";
import { useDebouncedCallback } from "@repo/ui/hooks/use-debounced-callback";
import { formatPrice } from "@repo/ui/lib/utils";
import { getPlaceDetails, suggestLocations } from "@repo/ui/lib/location";

type RouteLocationValue = TRoute["departureCity"];

export interface RouteLocationUi {
  query: string;
  suggestions: LocationSuggestion[];
  isLoading: boolean;
  isOpen: boolean;
  message: string;
  ref: RefObject<HTMLDivElement | null>;
  focus: (otherField?: RouteLocationUi) => void;
  handleInputChange: (
    value: string,
    onChange: (value: RouteLocationValue) => void,
    otherField?: RouteLocationUi,
  ) => void;
  handleSelect: (
    location: LocationSuggestion,
    onChange: (value: RouteLocationValue) => void,
  ) => Promise<void>;
  close: () => void;
  reset: (value?: string) => void;
}

interface RoutePriceUi {
  display: string;
  handleFocus: (value?: number) => void;
  handleChange: (value: string, onChange: (value: number) => void) => void;
  handleBlur: (onBlur: () => void) => void;
  reset: (value?: number) => void;
}

export interface RouteFormUi {
  departure: RouteLocationUi;
  arrival: RouteLocationUi;
  price: RoutePriceUi;
  reset: (defaults?: Partial<TRoute>) => void;
}

function buildInitialPrice(value?: number) {
  return value ? formatPrice(value) : "";
}

function useRouteLocationUi(initialQuery = ""): RouteLocationUi {
  const [query, setQuery] = useState(initialQuery);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useDebouncedCallback(async (value: string) => {
    try {
      const response = await suggestLocations(value);
      setSuggestions(response);
      setMessage("");
    } catch (error) {
      setSuggestions([]);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load locations right now.",
      );
    } finally {
      setIsLoading(false);
    }
  }, 400);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const open = useCallback(() => {
    setIsOpen(true);
  }, []);

  const reset = useCallback((value = "") => {
    fetchSuggestions.cancel();
    setQuery(value);
    setSuggestions([]);
    setIsLoading(false);
    setIsOpen(false);
    setMessage("");
  }, [fetchSuggestions]);

  const focus = useCallback(
    (otherField?: RouteLocationUi) => {
      if (query.length > 1) {
        open();
      }
      otherField?.close();
    },
    [open, query],
  );

  const handleInputChange = useCallback(
    (
      value: string,
      onChange: (value: RouteLocationValue) => void,
      otherField?: RouteLocationUi,
    ) => {
      setQuery(value);
      setMessage("");
      onChange({
        title: value,
        locality: "Unknown",
        label: value,
      });
      otherField?.close();

      if (value.length > 1) {
        open();
        setIsLoading(true);
        fetchSuggestions(value);
        return;
      }

      fetchSuggestions.cancel();
      setSuggestions([]);
      setIsLoading(false);
      close();
    },
    [close, fetchSuggestions, open],
  );

  const handleSelect = useCallback(
    async (
      location: LocationSuggestion,
      onChange: (value: RouteLocationValue) => void,
    ) => {
      setQuery(location.title);
      setMessage("");
      close();

      onChange({
        title: location.title,
        locality: "Loading...",
        label: location.label || "",
      });

      try {
        const details = (await getPlaceDetails(
          location.placeId,
        )) as AWSPlaceDetails | null;

        if (!details?.Address) {
          onChange({
            title: location.title,
            locality: location.title,
            label: location.label || "",
          });
          return;
        }

        onChange({
          title: location.title,
          locality:
            details.Address.Locality || details.Address.City || location.title,
          label: details.Address.Label || location.label || "",
        });
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load location details right now.",
        );
        onChange({
          title: location.title,
          locality: location.title,
          label: location.label || "",
        });
        return;
      }
    },
    [close],
  );

  return useMemo(
    () => ({
      query,
      suggestions,
      isLoading,
      isOpen,
      message,
      ref,
      focus,
      handleInputChange,
      handleSelect,
      close,
      reset,
    }),
    [
      close,
      focus,
      handleInputChange,
      handleSelect,
      isLoading,
      isOpen,
      message,
      query,
      reset,
      suggestions,
    ],
  );
}

function useRoutePriceUi(initialValue?: number): RoutePriceUi {
  const [display, setDisplay] = useState(buildInitialPrice(initialValue));

  const handleFocus = useCallback((value?: number) => {
    setDisplay(value ? String(value) : "");
  }, []);

  const handleChange = useCallback(
    (value: string, onChange: (value: number) => void) => {
      const raw = value.replace(/[^0-9.]/g, "");
      setDisplay(raw);
      onChange(raw === "" ? NaN : parseFloat(raw));
    },
    [],
  );

  const handleBlur = useCallback(
    (onBlur: () => void) => {
      const parsedValue = parseFloat(display);
      setDisplay(
        Number.isNaN(parsedValue) || parsedValue === 0
          ? ""
          : formatPrice(parsedValue),
      );
      onBlur();
    },
    [display],
  );

  const reset = useCallback((value?: number) => {
    setDisplay(buildInitialPrice(value));
  }, []);

  return useMemo(
    () => ({
      display,
      handleFocus,
      handleChange,
      handleBlur,
      reset,
    }),
    [display, handleBlur, handleChange, handleFocus, reset],
  );
}

export function useRouteFormUi(defaultValues?: Partial<TRoute>): RouteFormUi {
  const departure = useRouteLocationUi(defaultValues?.departureCity?.title);
  const arrival = useRouteLocationUi(defaultValues?.arrivalCity?.title);
  const price = useRoutePriceUi(defaultValues?.price);

  useClickOutside([departure.ref, arrival.ref], () => {
    departure.close();
    arrival.close();
  });

  const reset = useCallback(
    (values?: Partial<TRoute>) => {
      departure.reset(values?.departureCity?.title);
      arrival.reset(values?.arrivalCity?.title);
      price.reset(values?.price);
    },
    [arrival, departure, price],
  );

  return useMemo(
    () => ({
      departure,
      arrival,
      price,
      reset,
    }),
    [arrival, departure, price, reset],
  );
}
