import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./index";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const client = postgres(process.env.DATABASE_URL as string, {
  max: 25,
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
