import type { Route } from "@shared/types";

export const FUNAAB_ORIGIN = "FUNAAB";

export const FUNAAB_ROUTES: Route[] = [
  {
    id: "mock-funaab-oshodi-morning",
    fee: 500,
    origin_title: "Funaab",
    origin_locality: "Abeokuta",
    origin_label:
      "Federal University of Agriculture, Abeokuta (FUNAAB), Alabata, Ogun State",
    destination_title: null,
    destination_locality: null,
    destination_label: null,
    train_station_title: "Professor Wole Soyinka Station",
    train_station_locality: "Abeokuta",
    train_station_label: "Professor Wole Soyinka Station Abeokuta",
    pickup_point: "FUNAAB Main Gate, Alabata",
    dropoff_point: "Professor Wole Soyinka Station",
    price: 4500,
    luggage_fee: 1000,
    departure_time: ["6:00", "8:30", "12:00"],
    arrival_time: ["7:00", "9:15", "12:30"],
    status: "active",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
  },
];
