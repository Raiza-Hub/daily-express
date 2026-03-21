import dotenv from "dotenv";
dotenv.config();
import { Config, defineConfig } from "drizzle-kit";

// export default defineConfig({
//   schema: "./db/schema.ts",
//   out: "./db/migrations",
//   dialect: "postgresql",
//   dbCredentials: {
//     url: process.env.DATABASE_URL as string,
//   },
// } satisfies Config);

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
} satisfies Config);