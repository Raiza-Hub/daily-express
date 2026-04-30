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

const kafka = new Kafka({
  clientId: 'kafka-test',
  brokers: ['pkc-oxqxx9.us-east-1.aws.confluent.cloud:9092'],
  ssl: getSslConfig(),
  sasl: { mechanism: 'plain', username: '3EH7KQJIHPRMB5DX', password: 'cfltwTIFYQgBdicizks3VwpzzIw9Yk/P2i3inHiBGL9WhGjsIM+DCGTHaZT9W55g' },
  connectionTimeout: 30000,
  requestTimeout: 30000,
  retry: { retries: 10, initialRetryTime: 3000, factor: 1 },
  logLevel: 0 // disable kafkajs logging
});

async function main() {
  console.log('Testing Kafka connection...');
  
  // Test admin
  const admin = kafka.admin();
  try {
    await admin.connect();
    console.log('✓ Admin connected!');
    const topics = await admin.listTopics();
    console.log(`✓ Found ${topics.length} topics`);
    await admin.disconnect();
    console.log('✓ Admin disconnected');
  } catch(e) {
    console.error('✗ Admin failed:', e.message);
  }
  
  // Test producer
  const producer = kafka.producer({ idempotent: true });
  try {
    console.log('Connecting producer...');
    await producer.connect();
    console.log('✓ Producer connected!');
    
    const result = await producer.send({
      topic: 'notification.email.send',
      messages: [{ value: JSON.stringify({ test: 'hello', time: new Date().toISOString() }) }]
    });
    console.log(`✓ Message sent! Offset: ${result[0].baseOffset}`);
    await producer.disconnect();
    console.log('✓ Producer disconnected');
  } catch(e) {
    console.error('✗ Producer failed:', e.message);
  }
}

main().catch(e => {
  console.error('Fatal error:', e.message);
  process.exit(1);
});
