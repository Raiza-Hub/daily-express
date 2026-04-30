import { KAFKA_CONFIG } from "./config";
import { logger } from "../logger";

export interface OutboxEvent {
  id?: string;
  event_id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  event_version?: number;
  payload: any;
  headers?: Record<string, string>;
  trace_id?: string;
  span_id?: string;
  created_at?: Date;
  processing_started_at?: Date;
  published_at?: Date;
  status?: string;
  retry_count?: number;
  next_retry_at?: Date;
  last_error?: string;
  locked_at?: Date;
  locked_by?: string;
}

export interface WriteToOutboxParams {
  eventId: string;
  aggregateType: string;
  aggregateId: string;
  eventType: string;
  payload: any;
  headers?: Record<string, string>;
  traceId?: string;
  spanId?: string;
  eventVersion?: number;
}

export function createOutboxEvent(
  params: WriteToOutboxParams,
): Omit<
  OutboxEvent,
  | "id"
  | "created_at"
  | "processing_started_at"
  | "published_at"
  | "status"
  | "retry_count"
  | "next_retry_at"
  | "last_error"
  | "locked_at"
  | "locked_by"
> {
  const payloadSize = Buffer.byteLength(JSON.stringify(params.payload));

  if (payloadSize > KAFKA_CONFIG.maxPayloadSizeBytes) {
    throw new Error(
      `Payload size ${payloadSize} bytes exceeds maximum ${KAFKA_CONFIG.maxPayloadSizeBytes} bytes. ` +
        `Consider storing references instead of full objects.`,
    );
  }

  return {
    event_id: params.eventId,
    aggregate_type: params.aggregateType,
    aggregate_id: params.aggregateId,
    event_type: params.eventType,
    event_version: params.eventVersion || 1,
    payload: params.payload,
    headers: params.headers,
    trace_id: params.traceId,
    span_id: params.spanId,
  };
}

export function generateRetryTopicName(
  originalTopic: string,
  attemptNumber: number,
): string {
  const delay = KAFKA_CONFIG.retryTopic.delays[attemptNumber - 1] || "30m";
  return `${originalTopic}${KAFKA_CONFIG.retryTopic.prefix}${delay}`;
}

export function calculateNextRetryAt(retryCount: number): Date {
  const delays = KAFKA_CONFIG.outbox.retryDelaysMs;
  let delayMs = 60000; // default 1 minute

  if (retryCount === 1) {
    delayMs = delays[1] || 300000;
  } else if (retryCount >= 2) {
    delayMs = delays[2] || 1800000;
  } else {
    delayMs = delays[0] || 60000;
  }

  return new Date(Date.now() + delayMs);
}
