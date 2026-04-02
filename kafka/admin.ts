import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "kafka-service",
  brokers: ["127.0.0.1:9094"],
});

const admin = kafka.admin();

async function createTopics() {
  await admin.connect();
  await admin.createTopics({
    topics: [
      {
        topic: "user-created",
        numPartitions: 1,
      },
      {
        topic: "forgot-password",
        numPartitions: 1,
      },
      {
        topic: "driver-created",
        numPartitions: 1,
      },
      {
        topic: "user-deleted",
        numPartitions: 1,
      },
      {
        topic: "driver-deleted",
        numPartitions: 1,
      },
    ],
  });
  await admin.disconnect();
}

createTopics();
