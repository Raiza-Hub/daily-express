export const KAFKA_CONFIG = {
  // Retry configuration
  retry: {
    maxAttempts: 3,
    delaysMs: [60_000, 300_000, 1_800_000], // 1m, 5m, 30m
  },

  // DLQ configuration
  dlq: {
    suffix: ".dlq",
    retentionMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // Retry topic pattern (Spring Kafka style)
  retryTopic: {
    prefix: ".retry.",
    delays: ["1m", "5m", "30m"],
  },

  // Outbox worker configuration
  outbox: {
    pollingIntervalMs: 200,
    batchSize: 100,
    jitterMs: 200,
    maxRetries: 3,
    retryDelaysMs: [60_000, 300_000, 1_800_000],
    retentionDays: 7,

    // Backpressure thresholds
    backpressure: {
      warning: 10_000,
      critical: 50_000,
      emergency: 100_000,
    },

    // Circuit breaker
    circuitBreaker: {
      maxConsecutiveFailures: 10,
      pauseDurationMs: 30_000,
    },

    // Lock timeout to prevent stuck rows
    lockTimeoutMinutes: 5,

    // DB pool (dedicated for worker)
    dbPool: {
      max: 2,
      min: 1,
    },
  },

  // Idempotency
  idempotency: {
    ttlSeconds: 86400, // 24 hours
    keyPrefix: "kafka:idempotency:",
  },

  // Payload size limit
  maxPayloadSizeBytes: 32 * 1024, // 32KB
} as const;

export type KafkaConfig = typeof KAFKA_CONFIG;
