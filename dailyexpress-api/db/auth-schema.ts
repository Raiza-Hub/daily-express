import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  dateOfBirth: timestamp("date_of_birth", { mode: "date" }).notNull(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  referral: text("referral"),
  profilePictureUrl: text("profile_picture_url"),
  phone: text("phone"),
  gender: text("gender"),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const userProviders = pgTable(
  "user_providers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider").notNull(),
    providerId: text("provider_id").notNull(),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_providers_provider_provider_id_unique_idx").on(
      table.provider,
      table.providerId,
    ),
    uniqueIndex("user_providers_user_id_provider_unique_idx").on(
      table.userId,
      table.provider,
    ),
  ],
);

export const authSchema = {
  users,
  userProviders,
};

export type User = typeof users.$inferSelect;
export type UserRecord = User;
export type UserProvider = typeof userProviders.$inferSelect;
export type UserProviderRecord = UserProvider;