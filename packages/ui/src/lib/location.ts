import type { AWSPlaceDetails } from "@repo/types";
import type { LocationSuggestion } from "../components/location-dropdown";

type SuggestLocationsResponse = {
  suggestions?: LocationSuggestion[];
  message?: string;
};

type PlaceDetailsResponse = {
  details?: AWSPlaceDetails | null;
  message?: string;
};

async function parseLocationResponse<T extends { message?: string }>(
  response: Response,
): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as T;

  if (!response.ok) {
    throw new Error(payload.message || "Location lookup failed.");
  }

  return payload;
}

export async function suggestLocations(
  query: string,
): Promise<LocationSuggestion[]> {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const searchParams = new URLSearchParams({
    query: trimmedQuery,
  });
  const response = await fetch(`/api/location/suggest?${searchParams}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const payload =
    await parseLocationResponse<SuggestLocationsResponse>(response);

  return payload.suggestions ?? [];
}

export async function getPlaceDetails(placeId: string) {
  if (!placeId) {
    return null;
  }

  const searchParams = new URLSearchParams({
    placeId,
  });
  const response = await fetch(`/api/location/place?${searchParams}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const payload = await parseLocationResponse<PlaceDetailsResponse>(response);

  return payload.details ?? null;
}
