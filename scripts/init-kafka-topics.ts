import { ensureTopics } from "../shared/kafka";

const MAX_RETRIES = 15;
const RETRY_DELAY_MS = 2000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await ensureTopics();
      console.log("Kafka topics are ready");
      return;
    } catch (error) {
      if (attempt === MAX_RETRIES) {
        throw error;
      }

      console.warn(
        `Kafka init attempt ${attempt} failed. Retrying in ${RETRY_DELAY_MS}ms...`,
      );
      await sleep(RETRY_DELAY_MS);
    }
  }
}

main().catch((error) => {
  console.error("Failed to initialize Kafka topics", error);
  process.exit(1);
});
