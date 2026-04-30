import { KAFKA_CONFIG } from "./config";
import { getProducer } from "./index";
import { logger } from "../logger";

export interface DLQMessage {
  originalTopic: string;
  originalPartition?: number;
  originalOffset?: string;
  eventId: string;
  aggregateId: string;
  payload: any;
  error: string;
  errorStack?: string;
  retryCount: number;
  failedAt: string;
  attemptNumber: number;
  serviceName: string;
  traceId?: string;
  spanId?: string;
}

export async function sendToDLQ(
  originalTopic: string,
  eventId: string,
  aggregateId: string,
  error: Error,
  retryCount: number,
  payload: any,
  traceId?: string,
  spanId?: string,
): Promise<void> {
  const producer = await getProducer();
  const dlqTopic = `${originalTopic}${KAFKA_CONFIG.dlq.suffix}`;

  const dlqMessage: DLQMessage = {
    originalTopic,
    eventId,
    aggregateId,
    payload,
    error: error.message,
    errorStack: error.stack,
    retryCount,
    failedAt: new Date().toISOString(),
    attemptNumber: retryCount + 1,
    serviceName: process.env.SERVICE_NAME || "unknown",
    traceId,
    spanId,
  };

  try {
    await producer.send({
      topic: dlqTopic,
      messages: [
        {
          key: aggregateId,
          value: JSON.stringify(dlqMessage),
          headers: {
            "x-event-id": eventId,
            "x-retry-count": retryCount.toString(),
            "x-error-type": error.constructor.name,
            "x-service": process.env.SERVICE_NAME || "unknown",
            "x-failed-at": dlqMessage.failedAt,
          },
        },
      ],
    });

    logger.info("kafka.dlq_message_sent", {
      topic: dlqTopic,
      eventId,
      retryCount,
    });
  } catch (err) {
    logger.error("kafka.dlq_send_failed", {
      topic: dlqTopic,
      eventId,
      error: err,
    });
    throw err;
  }
}
