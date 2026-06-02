import { relations } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const bankVerificationStatusEnum = pgEnum("bank_verification_status", [
  "pending",
  "active",
  "failed",
]);

export const driverProfileImageUploadStatusEnum = pgEnum(
  "driver_profile_image_upload_status",
  ["pending", "processing", "succeeded", "failed"],
);

export const driver = pgTable("driver", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  profile_pic: text("profile_picture"),
  phone: text("phone").notNull(),
  country: text("country").notNull(),
  currency: text("currency").notNull(),
  state: text("state").notNull(),
  city: text("city").notNull(),
  address: text("address").notNull(),
  bankName: text("bank_name").notNull(),
  bankCode: text("bank_code").notNull(),
  accountNumber: text("account_number").notNull(),
  accountName: text("account_name").notNull(),
  bankVerificationStatus: bankVerificationStatusEnum("bank_verification_status")
    .default("pending")
    .notNull(),
  bankVerificationFailureReason: text("bank_verification_failure_reason"),
  bankVerificationRequestedAt: timestamp("bank_verification_requested_at", {
    mode: "date",
  }),
  bankVerifiedAt: timestamp("bank_verified_at", { mode: "date" }),
  isActive: boolean("is_active").default(true).notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const driverStats = pgTable("driver_stats", {
  id: uuid("id").defaultRandom().primaryKey(),
  driverId: uuid("driver_id")
    .references(() => driver.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  totalEarnings: bigint("total_earnings", { mode: "number" })
    .default(0)
    .notNull(),
  pendingPayments: bigint("pending_payments", { mode: "number" })
    .default(0)
    .notNull(),
  totalPassengers: integer("total_passengers").default(0).notNull(),
  activeRoutes: integer("active_routes").default(0).notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const driverProfileImageUpload = pgTable(
  "driver_profile_image_upload",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    driverId: uuid("driver_id")
      .references(() => driver.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").notNull(),
    status: driverProfileImageUploadStatusEnum("status")
      .default("pending")
      .notNull(),
    fileName: text("file_name"),
    mimeType: varchar("mime_type", { length: 128 }).notNull(),
    size: integer("size").notNull(),
    fileBase64: text("file_base64").notNull(),
    oldProfilePictureUrl: text("old_profile_picture_url"),
    secureUrl: text("secure_url"),
    publicId: text("public_id"),
    errorMessage: text("error_message"),
    attempts: integer("attempts").default(0).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
    processedAt: timestamp("processed_at", { mode: "date" }),
  },
  (table) => [
    index("driver_profile_image_upload_driver_id_idx").on(table.driverId),
    index("driver_profile_image_upload_status_idx").on(table.status),
    index("driver_profile_image_upload_user_id_idx").on(table.userId),
  ],
);

export const driverRelations = relations(driver, ({ one }) => ({
  stats: one(driverStats, {
    relationName: "driver_stats",
    fields: [driver.id],
    references: [driverStats.driverId],
  }),
}));

export const driverStatsRelations = relations(driverStats, ({ one }) => ({
  driver: one(driver, {
    relationName: "driver_stats",
    fields: [driverStats.driverId],
    references: [driver.id],
  }),
}));

export const driverSchema = {
  driver,
  driverStats,
  driverProfileImageUpload,
};

export type Driver = typeof driver.$inferSelect;
export type DriverStats = typeof driverStats.$inferSelect;
export type DriverProfileImageUpload =
  typeof driverProfileImageUpload.$inferSelect;
