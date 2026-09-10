import type { Route } from "@shared/types";

export const FUNAAB_ORIGIN = "FUNAAB";

export const FUNAAB_ROUTES: Route[] = [
  {
    id: "mock-funaab-oshodi-morning",
    fee: null,
    pickup_location_title: "Funaab",
    pickup_location_locality: "Abeokuta",
    pickup_location_label:
      "Federal University of Agriculture, Abeokuta (FUNAAB), Alabata, Ogun State",
    dropoff_location_title: "Professor Wole Soyinka Station",
    dropoff_location_locality: "Abeokuta",
    dropoff_location_label: "Professor Wole Soyinka Station Abeokuta",
    intermediate_stops_title: null,
    intermediate_stops_locality: null,
    intermediate_stops_label: null,
    meeting_point: "FUNAAB Main Gate, Alabata",
    price: 4500,
    luggage_fee: 1000,
    departure_time: ["6:00", "8:30", "12:00"],
    arrival_time: ["7:00", "9:15", "12:30"],
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];
