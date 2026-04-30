import { Counter, Gauge, Histogram } from "prom-client";

export const kafkaOutboxMetrics = {
  // Outbox metrics
  outboxPending: new Gauge({
    name: "kafka_outbox_pending_total",
    help: "Total number of pending outbox events",
    labelNames: ["service", "aggregate_type"],
  }),

  outboxPublished: new Counter({
    name: "kafka_outbox_published_total",
    help: "Total number of published outbox events",
    labelNames: ["service", "topic", "status"],
  }),

  outboxFailed: new Counter({
    name: "kafka_outbox_failed_total",
    help: "Total number of failed outbox events",
    labelNames: ["service", "topic", "error_type"],
  }),

  outboxProcessingDuration: new Histogram({
    name: "kafka_outbox_processing_duration_seconds",
    help: "Time spent processing outbox events",
    labelNames: ["service", "topic"],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  // Consumer metrics
  consumerLag: new Gauge({
    name: "kafka_consumer_lag",
    help: "Consumer lag in messages",
    labelNames: ["topic", "group", "partition"],
  }),

  consumerProcessed: new Counter({
    name: "kafka_messages_processed_total",
    help: "Total number of messages processed",
    labelNames: ["topic", "service", "status"],
  }),

  consumerProcessingDuration: new Histogram({
    name: "kafka_message_processing_duration_seconds",
    help: "Time spent processing messages",
    labelNames: ["topic", "service"],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),

  // DLQ metrics
  dlqMessages: new Counter({
    name: "kafka_dlq_messages_total",
    help: "Total messages sent to DLQ",
    labelNames: ["topic", "service", "error_type"],
  }),

  // Retry metrics
  retryAttempts: new Counter({
    name: "kafka_retry_attempts_total",
    help: "Total retry attempts",
    labelNames: ["topic", "attempt"],
  }),

  // Backpressure metrics
  backpressureActive: new Gauge({
    name: "kafka_backpressure_active",
    help: "Whether backpressure is active",
    labelNames: ["service", "level"],
  }),
};

// Export metrics for Prometheus scraping
export const metrics = [
  kafkaOutboxMetrics.outboxPending,
  kafkaOutboxMetrics.outboxPublished,
  kafkaOutboxMetrics.outboxFailed,
  kafkaOutboxMetrics.outboxProcessingDuration,
  kafkaOutboxMetrics.consumerLag,
  kafkaOutboxMetrics.consumerProcessed,
  kafkaOutboxMetrics.consumerProcessingDuration,
  kafkaOutboxMetrics.dlqMessages,
  kafkaOutboxMetrics.retryAttempts,
  kafkaOutboxMetrics.backpressureActive,
];
