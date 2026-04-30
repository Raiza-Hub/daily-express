import { and, eq, isNull, or, lte, count } from "drizzle-orm";
import { EVENT_SCHEMAS, type SupportedEventType } from "./events";
import {
  KAFKA_CONFIG,
  encodeEvent,
} from "./index";
import { getProducer } from "./index";
import { calculateNextRetryAt } from "./outbox";
import { sendToDLQ } from "./dlq";
import { logger } from "../logger";
import { kafkaOutboxMetrics } from "./metrics";

export interface OutboxWorkerDependencies {
  db: any;
  outboxTable: any;
  serviceName: string;
}

export function createOutboxWorker(dependencies: OutboxWorkerDependencies) {
  const { db, outboxTable, serviceName } = dependencies;

  let isRunning = false;
  let pollingTimer: ReturnType<typeof setTimeout> | null = null;
  let consecutiveFailures = 0;

  async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function getPendingEvents() {
    return db
      .select()
      .from(outboxTable)
      .where(
        and(
          eq(outboxTable.status, "PENDING"),
          or(
            isNull(outboxTable.nextRetryAt),
            lte(outboxTable.nextRetryAt, new Date()),
          ),
        ),
      )
      .orderBy(outboxTable.createdAt)
      .limit(KAFKA_CONFIG.outbox.batchSize);
  }

  async function markAsPublished(id: string) {
    await db
      .update(outboxTable)
      .set({
        status: "PUBLISHED",
        publishedAt: new Date(),
        lockedAt: null,
      })
      .where(eq(outboxTable.id, id));
  }

  async function markAsFailed(
    id: string,
    errorMessage: string,
    nextRetryAt: Date,
    retryCount: number,
  ) {
    await db
      .update(outboxTable)
      .set({
        status: "PENDING",
        retryCount: retryCount,
        nextRetryAt: nextRetryAt,
        lastError: errorMessage,
        lockedAt: null,
      })
      .where(eq(outboxTable.id, id));
  }

  async function checkBackpressure() {
    const result = await db
      .select({ count: count() })
      .from(outboxTable)
      .where(eq(outboxTable.status, "PENDING"));
    return result[0]?.count || 0;
  }

  async function processEvent(event: any): Promise<void> {
    const producer = await getProducer();

    const eventType = event.eventType;

    if (!(eventType in EVENT_SCHEMAS)) {
      throw new Error(
        `[outbox-worker] Unsupported event type ${eventType} for topic ${event.aggregateType}`,
      );
    }

    let messageValue: Buffer;

    try {
      messageValue = await encodeEvent(
        eventType as SupportedEventType,
        event.payload,
      );
    } catch (error) {
      console.error(
        `[outbox-worker] Schema encoding failed for topic ${event.aggregateType}:`,
        error,
      );
      throw error;
    }

    await producer.send({
      topic: event.aggregateType,
      messages: [
        {
          key: event.aggregateId,
          value: messageValue,
          headers: {
            "x-event-id": event.eventId,
            "x-retry-count": String(event.retryCount || 0),
            "x-error-type": event.lastError?.split(":")[0] || "",
            "x-service": serviceName,
            "x-trace-id": event.traceId || "",
            "x-span-id": event.spanId || "",
          },
        },
      ],
    });
  }

  async function pollAndProcess(): Promise<void> {
    try {
      const pendingCount = await checkBackpressure();

      if (pendingCount >= KAFKA_CONFIG.outbox.backpressure.warning) {
        const level =
          pendingCount >= KAFKA_CONFIG.outbox.backpressure.emergency
            ? "emergency"
            : pendingCount >= KAFKA_CONFIG.outbox.backpressure.critical
              ? "critical"
              : "warning";

        logger.warn("kafka.backpressure_active", {
          pendingCount,
          level,
          serviceName,
        });
        kafkaOutboxMetrics.backpressureActive.set(
          { service: serviceName, level },
          1,
        );

        if (level === "emergency") {
          return;
        }
      } else {
        kafkaOutboxMetrics.backpressureActive.set(
          { service: serviceName, level: "none" },
          0,
        );
      }

      if (
        consecutiveFailures >=
        KAFKA_CONFIG.outbox.circuitBreaker.maxConsecutiveFailures
      ) {
        logger.warn("kafka.circuit_breaker_open", {
          consecutiveFailures,
          pauseMs: KAFKA_CONFIG.outbox.circuitBreaker.pauseDurationMs,
        });
        await sleep(KAFKA_CONFIG.outbox.circuitBreaker.pauseDurationMs);
        consecutiveFailures = 0;
      }

      const events = await getPendingEvents();

      if (events.length === 0) {
        return;
      }

      for (const event of events) {
        const startTime = Date.now();

        try {
          await processEvent(event);
          await markAsPublished(event.id);

          kafkaOutboxMetrics.outboxPublished.inc({
            service: serviceName,
            topic: event.aggregateType,
            status: "success",
          });

          consecutiveFailures = 0;

          logger.info("kafka.outbox_event_published", {
            eventId: event.eventId,
            topic: event.aggregateType,
            durationMs: Date.now() - startTime,
          });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          const retryCount = (event.retryCount || 0) + 1;

          if (retryCount >= KAFKA_CONFIG.outbox.maxRetries) {
            try {
              await sendToDLQ(
                event.aggregateType,
                event.eventId,
                event.aggregateId,
                err,
                retryCount,
                event.payload,
                event.traceId,
                event.spanId,
              );

              await markAsFailed(event.id, err.message, new Date(), retryCount);

              kafkaOutboxMetrics.dlqMessages.inc({
                topic: event.aggregateType,
                service: serviceName,
                error_type: err.constructor.name,
              });

              kafkaOutboxMetrics.outboxFailed.inc({
                service: serviceName,
                topic: event.aggregateType,
                error_type: err.constructor.name,
              });

              logger.error("kafka.dlq_event_sent", {
                eventId: event.eventId,
                error: err.message,
                retryCount,
              });
            } catch (dlqError: unknown) {
              const dlqErr =
                dlqError instanceof Error ? dlqError.message : String(dlqError);
              logger.error("kafka.dlq_send_failed", {
                eventId: event.eventId,
                error: dlqErr,
              });
            }
          } else {
            const nextRetryAt = calculateNextRetryAt(retryCount - 1);
            await markAsFailed(event.id, err.message, nextRetryAt, retryCount);

            kafkaOutboxMetrics.retryAttempts.inc({
              topic: event.aggregateType,
              attempt: String(retryCount),
            });

            logger.warn("kafka.outbox_event_retry_scheduled", {
              eventId: event.eventId,
              retryCount,
              nextRetryAt: nextRetryAt.toISOString(),
              error: err.message,
            });
          }

          consecutiveFailures++;
        }

        kafkaOutboxMetrics.outboxProcessingDuration.observe(
          { service: serviceName, topic: event.aggregateType },
          (Date.now() - startTime) / 1000,
        );
      }
    } catch (error) {
      logger.error("kafka.outbox_poll_error", { error });
    }
  }

  async function start(): Promise<void> {
    if (isRunning) {
      return;
    }

    isRunning = true;
    logger.info("kafka.outbox_worker_started", { serviceName });

    const poll = async () => {
      if (!isRunning) {
        return;
      }

      await pollAndProcess();

      const jitter = Math.random() * KAFKA_CONFIG.outbox.jitterMs;
      const nextPollMs = KAFKA_CONFIG.outbox.pollingIntervalMs + jitter;

      pollingTimer = setTimeout(poll, nextPollMs);
    };

    await poll();
  }

  async function stop(): Promise<void> {
    isRunning = false;

    if (pollingTimer) {
      clearTimeout(pollingTimer);
      pollingTimer = null;
    }

    logger.info("kafka.outbox_worker_stopped", { serviceName });
  }

  return {
    start,
    stop,
  };
}
