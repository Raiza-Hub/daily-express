import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./auth-schema";

export const bankVerificationStatusEnum = pgEnum("bank_verification_status", [
  "active",
  "failed",
]);

export const kycStatusEnum = pgEnum("kyc_status", [
  "active",
  "failed",
]);

export const driver = pgTable("driver", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "restrict" })
    .notNull()
    .unique(),
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
  bankName: text("bank_name"),
  bankCode: text("bank_code"),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  bankVerificationStatus: bankVerificationStatusEnum("bank_verification_status"),
  kycStatus: kycStatusEnum("kyc_status"),
  kycType: text("kyc_type"),
  kycId: text("kyc_id"),
  kycVerificationReference: text("kyc_verification_reference"),
  lastAssignedAt: timestamp("last_assigned_at", { mode: "date" }),
  isActive: boolean("is_active").default(true).notNull(),
  deletedAt: timestamp("deleted_at", { mode: "date" }),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" }).defaultNow().notNull(),
});

export const driverSchema = {
  driver,
};

export type Driver = typeof driver.$inferSelect;
export type DriverRecord = Driver;
