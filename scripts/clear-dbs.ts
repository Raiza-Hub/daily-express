import { $ } from "bun";

const DB_PREFIX = "dailyExpress_";
const POSTGRES_USER = "postgres";
const CONTAINER_NAME = "daily_express";

async function runPsql(query: string, db: string = "postgres") {
  try {
    // Check if docker container is running
    const containerStatus = await $`docker inspect -f '{{.State.Running}}' ${CONTAINER_NAME}`.quiet().text();
    
    if (containerStatus.trim() === "true") {
      return await $`docker exec ${CONTAINER_NAME} psql -U ${POSTGRES_USER} -d ${db} -t -c "${query}"`.quiet().text();
    } else {
      // Fallback to local psql if docker is not running
      return await $`psql -U ${POSTGRES_USER} -d ${db} -t -c "${query}"`.quiet().text();
    }
  } catch (error) {
    // If docker fails, try local psql directly
    try {
      return await $`psql -U ${POSTGRES_USER} -d ${db} -t -c "${query}"`.quiet().text();
    } catch (localError) {
      throw new Error(`Failed to run psql command. Make sure Postgres is running locally or in Docker (${CONTAINER_NAME}).`);
    }
  }
}

async function main() {
  console.log("🔍 Finding databases to clear...");

  const result = await runPsql(`SELECT datname FROM pg_database WHERE datname LIKE '${DB_PREFIX}%';`);
  const dbs = result
    .split("\n")
    .map((name: string) => name.trim())
    .filter((name: string) => name.length > 0);

  if (dbs.length === 0) {
    console.log("✅ No databases found with prefix:", DB_PREFIX);
    return;
  }

  console.log(`🧹 Found ${dbs.length} databases:`, dbs.join(", "));

  for (const db of dbs) {
    console.log(`\nProcessing database: ${db}`);
    
    try {
      // 1. Terminate connections
      console.log(`🔌 Terminating connections to ${db}...`);
      await runPsql(`
        SELECT pg_terminate_backend(pid) 
        FROM pg_stat_activity 
        WHERE datname = '${db}' 
        AND pid <> pg_backend_pid();
      `);

      // 2. Truncate all tables
      console.log(`✨ Clearing all tables in ${db}...`);
      const truncateQuery = `
        DO $$ 
        DECLARE 
            r RECORD;
        BEGIN
            FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
                EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
            END LOOP;
        END $$;
      `;
      await runPsql(truncateQuery, db);
      
      console.log(`✅ Successfully cleared all data in ${db}`);
    } catch (error: any) {
      console.error(`❌ Failed to clear ${db}:`, error.message);
    }
  }

  console.log("\n✨ Done!");
}

main().catch((err) => {
  console.error("💥 Critical error:", err.message);
  process.exit(1);
});
