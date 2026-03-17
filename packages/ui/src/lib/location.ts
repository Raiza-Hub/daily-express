"use server";

import { SuggestCommand, GetPlaceCommand } from "@aws-sdk/client-geo-places";
import type { LocationSuggestion } from "../components/location-dropdown";
import { getGeoPlacesClient, getRedis } from "./location-client";

export async function suggestLocations(query: string): Promise<LocationSuggestion[]> {
    try {
        if (!query || query.trim().length === 0) return [];

        const client = getGeoPlacesClient();

        const command = new SuggestCommand({
            QueryText: query,
            MaxResults: 5,
            BiasPosition: [8.6753, 9.0820], // Nigeria coordinates [Longitude, Latitude]
        });

        const response = await client.send(command);

        const suggestions: LocationSuggestion[] = (response.ResultItems || []).map((item) => ({
            placeId: item.Place?.PlaceId || "",
            title: item.Title || "Unknown Location",
            label: item.Place?.Address?.Label || "Unknown Location"
        })).filter(s => s.placeId !== "");

        return suggestions;
    } catch (error) {
        console.error("Error suggesting locations:", error);
        return [];
    }
}

export async function getPlaceDetails(placeId: string) {
    try {
        if (!placeId) return null;

        const cacheKey = `location:place:${placeId}`;
        const redis = getRedis();

        if (redis) {
            const cached = await redis.get(cacheKey);
            if (cached) return cached;
        }

        const client = getGeoPlacesClient();

        const command = new GetPlaceCommand({
            PlaceId: placeId,
        });

        const response = await client.send(command);

        if (redis && response) {
            await redis.set(cacheKey, response, { ex: 60 * 60 * 24 * 30 }); // Cache for 30 days
        }
        
        return response;
    } catch (error) {
        console.error("Error getting place details:", error);
        return null;
    }
}
