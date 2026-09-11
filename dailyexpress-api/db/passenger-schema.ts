import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { booking } from "./route-schema";

export const passenger = pgTable(
  "passenger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookingId: uuid("booking_id")
      .references(() => booking.id, { onDelete: "restrict" })
      .notNull(),
    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    carriesLuggage: boolean("carries_luggage").default(false).notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("passenger_booking_idx").on(table.bookingId),
  ],
);

export const passengerSchema = {
  passenger,
};

export type Passenger = typeof passenger.$inferSelect;
export type PassengerRecord = Passenger;