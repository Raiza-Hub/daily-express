import "dotenv/config";
import { registerEventSchemas } from "../shared/kafka";

async function main() {
  const schemas = await registerEventSchemas();

  for (const schema of schemas) {
    console.log(
      `Registered ${schema.eventType} as ${schema.subject} with schema ID ${schema.id}`,
    );
  }

  console.log(`Kafka schemas are ready (${schemas.length} registered)`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error("Failed to register Kafka schemas", error);
    process.exit(1);
  });
}
