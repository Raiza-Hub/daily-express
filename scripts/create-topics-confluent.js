const { Kafka } = require('kafkajs');
const { checkServerIdentity } = require('tls');

// Bun SSL workaround (same as in shared/kafka/index.ts)
function getSslConfig() {
  if ((process.versions).bun) {
    return {
      checkServerIdentity: (host, cert) =>
        cert ? checkServerIdentity(host, cert) : undefined,
    };
  }
  return true;
}

const brokers = (process.env.KAFKA_BROKERS || 'pkc-oxqxx9.us-east-1.aws.confluent.cloud:9092').split(',').map(b => b.trim());
const saslUsername = process.env.KAFKA_SASL_USERNAME || process.env.KAFKA_API_KEY || '3EH7KQJIHPRMB5DX';
const saslPassword = process.env.KAFKA_SASL_PASSWORD || process.env.KAFKA_API_SECRET || 'cfltwTIFYQgBdicizks3VwpzzIw9Yk/P2i3inHiBGL9WhGjsIM+DCGTHaZT9W55g';

const TOPICS = [
  "notification.email.send",
  "user.account.created",
  "user.account.deleted",
  "driver.identity.created",
  "driver.identity.updated",
  "driver.identity.deleted",
  "driver.payout_profile.upserted",
  "driver.payout_profile.deleted",
  "user.identity.upserted",
  "route.created",
  "route.deleted",
  "booking.confirmed",
  "booking.cancelled",
  "trip.completed",
  "trip.cancelled",
  "payment.completed",
  "payment.failed",
  "payout.completed",
  "payout.failed",
  "driver.bank.verification.requested",
  "driver.bank.verified",
  "driver.bank.verification.failed",
];

const DLQ_SUFFIX = ".dlq";
const dlqTopics = TOPICS.map(t => t + DLQ_SUFFIX);
const serviceDlqTopics = ["notification-service.dlq"];
const allTopics = [...TOPICS, ...dlqTopics, ...serviceDlqTopics];

const kafka = new Kafka({
  clientId: 'daily-express-topic-creator',
  brokers,
  ssl: getSslConfig(),
  sasl: {
    mechanism: 'plain',
    username: saslUsername,
    password: saslPassword,
  },
  connectionTimeout: 30000,
  requestTimeout: 30000,
  retry: {
    initialRetryTime: 1000,
    retries: 3,
  },
});

async function main() {
  const admin = kafka.admin();
  
  try {
    console.log('Connecting to Kafka...');
    await admin.connect();
    console.log('✓ Connected to Kafka');
    
    const existingTopics = await admin.listTopics();
    console.log(`Found ${existingTopics.length} existing topics`);
    
    const topicsToCreate = allTopics.filter(t => !existingTopics.includes(t));
    
    if (topicsToCreate.length === 0) {
      console.log('✓ All topics already exist!');
      return;
    }
    
    console.log(`Creating ${topicsToCreate.length} topics one by one...`);
    let created = 0;
    let failed = 0;
    
    for (const topic of topicsToCreate) {
      try {
        await admin.createTopics({
          topics: [{ topic, numPartitions: 1, replicationFactor: 3 }],
          waitForLeaders: false,
        });
        console.log(`  ✓ ${topic}`);
        created++;
      } catch (err) {
        if (err.message.includes('already exists')) {
          console.log(`  - ${topic} (already exists)`);
        } else {
          console.log(`  ✗ ${topic}: ${err.message}`);
          failed++;
        }
      }
      // Small delay between creations
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`\nSummary: ${created} created, ${failed} failed`);
    
  } catch (error) {
    console.error('✗ Error:', error.message);
    throw error;
  } finally {
    await admin.disconnect();
  }
}

main().catch(error => {
  console.error('Failed to create topics:', error);
  process.exit(1);
});
