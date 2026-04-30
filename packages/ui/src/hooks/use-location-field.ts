import { useCallback, useRef, useState } from "react";
import { LocationSuggestion } from "../components/location-dropdown";
import { useDebouncedCallback } from "./use-debounced-callback";
import { suggestLocations } from "../lib/location";


export interface LocationFieldState {
  query: string;
  suggestions: LocationSuggestion[];
  isLoading: boolean;
  isOpen: boolean;
  message: string;
  ref: React.RefObject<HTMLDivElement | null>;
  setQuery: (value: string) => void;
  focus: (otherField?: LocationFieldState) => void;
  handleInputChange: (value: string, otherField?: LocationFieldState) => void;
  select: (location: LocationSuggestion) => void;
  close: () => void;
}

export function useLocationField(initialValue = ""): LocationFieldState {
  const [query, setQuery] = useState(initialValue);
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

  return {
    query,
    suggestions,
    isLoading,
    isOpen,
    message,
    ref,
    setQuery,
    focus: (otherField) => {
      if (query.length > 1) {
        setIsOpen(true);
      }
      otherField?.close();
    },
    handleInputChange: (value, otherField) => {
      setQuery(value);
      setMessage("");
      otherField?.close();

      if (value.length > 1) {
        setIsOpen(true);
        setIsLoading(true);
        fetchSuggestions(value);
        return;
      }

      fetchSuggestions.cancel();
      setSuggestions([]);
      setIsLoading(false);
      setIsOpen(false);
    },
    select: (location) => {
      setQuery(location.title);
      setMessage("");
      setIsOpen(false);
    },
    close,
  };
}