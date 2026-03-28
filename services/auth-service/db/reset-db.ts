import { db } from "./db";
import { users, otp } from "./schema";
import { sql } from "drizzle-orm";

async function resetDb() {
  console.log("Resetting database...");
  await db.execute(sql`TRUNCATE TABLE ${users} CASCADE`);
  await db.execute(sql`TRUNCATE TABLE ${otp} CASCADE`);
  console.log("Database reset successful.");
  process.exit(0);
}

resetDb().catch((err) => {
  console.error("Failed to reset database:", err);
  process.exit(1);
});
