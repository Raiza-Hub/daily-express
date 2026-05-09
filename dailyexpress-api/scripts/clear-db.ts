import "dotenv/config";
import postgres from "postgres";

const CONFIRM_TEXT = "CLEAR";
const EXCLUDED_TABLES = new Set([
  "__drizzle_migrations",
]);

function hasYesFlag() {
  return process.argv.includes("--yes") || process.argv.includes("-y");
}

async function readConfirmation(): Promise<string> {
  process.stdout.write(
    `This will truncate all dailyexpress-api tables for ${process.env.DATABASE_URL}.\nType ${CONFIRM_TEXT} to continue: `,
  );

  for await (const chunk of Bun.stdin.stream()) {
    return Buffer.from(chunk).toString("utf8").trim();
  }

  return "";
}

function quoteQualifiedTable(schema: string, table: string) {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`;
  return `${quote(schema)}.${quote(table)}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to clear the dailyexpress-api database.");
  }

  if (!hasYesFlag()) {
    const confirmation = await readConfirmation();
    if (confirmation !== CONFIRM_TEXT) {
      console.log("Cancelled.");
      return;
    }
  }

  const sql = postgres(databaseUrl, {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 10,
  });

  try {
    const tables = await sql<{
      table_schema: string;
      table_name: string;
    }[]>`
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema IN ('public', 'pgboss')
      ORDER BY table_schema, table_name
    `;

    const tableNames = tables
      .filter((table) => !EXCLUDED_TABLES.has(table.table_name))
      .map((table) => quoteQualifiedTable(table.table_schema, table.table_name));

    if (tableNames.length === 0) {
      console.log("No dailyexpress-api tables found to clear.");
      return;
    }

    await sql.unsafe(
      `TRUNCATE TABLE ${tableNames.join(", ")} RESTART IDENTITY CASCADE`,
    );

    console.log(`Cleared ${tableNames.length} dailyexpress-api tables.`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(
    "Failed to clear dailyexpress-api database:",
    error instanceof Error ? error.message : String(error),
  );
  process.exit(1);
});
