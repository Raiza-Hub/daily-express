# Architectural Specifications: Kafka and API Gateway

This document outlines the proposed integration of Apache Kafka for asynchronous event-driven communication and the definition of a centralized API Gateway within the `@services` ecosystem.

## 1. Kafka Integration (Async Events)

Kafka is used to decouple services and handle non-blocking side effects. Below is the mapping of Producers and Consumers based on the current service logic.

### Kafka Implementation Matrix

| Service | Producer (Events Emitted) | Consumer (Actions Triggered) | Trigger/Action Description |
| :--- | :--- | :--- | :--- |
| **`auth-service`** | `user.account.created` | - | Emitted after successful registration. |
| | `notification.email.send` | - | Emitted for OTPs, welcome emails, and reset links. |
| | `user.account.deleted` | - | Emitted when a user deletes their account. |
| **`mail-service`** | - | `notification.email.send` | Consumes email requests and sends them via Resend API. |
| **`driver-service`** | `driver.profile.updated` | - | Emitted when driver details change. |
| | - | `user.account.deleted` | Automatically deletes driver profile when user is deleted. |
| **`route-service`** | `route.created` | - | Emitted when a new route is published (for search index). |
| | `booking.confirmed` | - | Emitted when a trip booking is confirmed (for payout/notifications). |
| | `notification.email.send` | - | Emitted to notify passengers of booking confirmation. |

### Implementation Details

#### **Auth Service**
Currently, `authService.ts` makes a synchronous `fetch` call to the `mail-service`. This will be replaced with a Kafka producer that publishes to the `notification.email.send` topic, allowing the `auth-service` to respond immediately after database operations.

#### **Mail Service**
This service functions as an asynchronous worker. It will transition from an Express-based HTTP server to a Kafka consumer. The `sendMail` logic will be invoked by the consumer, ensuring that email delivery failures or delays do not impact other services.

#### **Driver Service**
Ensures data consistency by consuming `user.account.deleted`. This guarantees that all driver-related records are purged when a user account is removed, without requiring a direct API call from `auth-service`.

#### **Route Service**
Produces `route.created` and `booking.confirmed` events. These are critical for downstream services like a search engine (to update indices) or a payout system (to trigger transfers).

---

## 2. API Gateway Responsibilities

The API Gateway is the "front door" for all external requests. It shields internal microservices and provides a unified interface.

### Core Features
1.  **Centralized Authentication & Authorization**:
    *   Validate JWT tokens/cookies at the edge.
    *   Reject unauthorized requests before they hit internal services.
    *   Inject user context (e.g., `X-User-ID`, `X-User-Role`) headers.

2.  **Request Routing**:
    *   Map public paths (e.g., `/api/auth/**`) to internal service URLs.

3.  **Rate Limiting & Throttling**:
    *   Protect services from abuse or DDoS attacks.

4.  **CORS Handling**:
    *   Manage cross-origin policies globally.

---

## 3. Recommended Infrastructure (Docker Compose)
To support this architecture, the following services have been added to the project's orchestration:
- **Kafka (KRaft mode)**: The event streaming platform, running without ZooKeeper.

> [!TIP]
> Use `kafkajs` for the Node.js/Bun implementation across all services, and run Kafka in KRaft mode for local development.

---

## 4. Current Repo State

The repository already contains partial Kafka scaffolding, but it is not fully integrated into runtime behavior yet.

### Existing Pieces
- Shared Kafka client: `shared/kafka/index.ts`
- Shared local type shim: `shared/types/kafkajs.d.ts`
- Auth outbox publisher: `services/auth-service/src/kafka/outbox.ts`
- Driver producer/consumer: `services/driver-service/src/kafka/{producer,consumer}.ts`
- Route producers: `services/route-service/src/kafka/producer.ts`
- Mail consumer: `services/mail-service/src/kafka/consumer.ts`

### Missing Pieces
1. `kafkajs` is not declared in the relevant package manifests yet.
2. `docker-compose.yml` does not provision Kafka in KRaft mode.
3. No service entrypoint currently starts its Kafka consumer.
4. Producer helpers exist, but they are not consistently called from business workflows.
5. There is no event envelope/versioning strategy yet.
6. There is no retry/DLQ policy or idempotency contract yet.

This means the repo is in a "Kafka helpers exist, runtime integration incomplete" state.

---

## 5. Implementation Plan

The safest implementation order is:

### Industry-Standard Architecture Baseline

For this project, "industry standard" should mean:

1. **Kafka in KRaft mode**
   - no ZooKeeper for new deployments
2. **Separate controller and broker roles in production**
   - combined `broker,controller` only for local development
3. **Schema-managed events**
   - use Avro, Protobuf, or JSON Schema with a schema registry
4. **Transactional outbox pattern for DB-backed services**
   - do not rely on "DB write succeeded, then publish directly" for critical events
5. **Idempotent producers and idempotent consumers**
6. **Dead-letter topics and replay strategy**
7. **Clear event ownership and versioned contracts**

This is the recommended target design.

### Phase 1: Infrastructure and Shared Contracts
Goal: make Kafka available and define stable event shapes before wiring business flows.

Tasks:
1. Add Kafka infrastructure to `docker-compose.yml`.
   - Add a single Kafka broker in KRaft mode
   - Expose broker on a stable internal hostname
   - Add health checks
   - Set `KAFKA_CFG_PROCESS_ROLES=broker,controller`
   - Set controller quorum listeners and node ID explicitly
   - For production planning, document a separate-role topology:
     - 3 controllers
     - 3+ brokers
2. Add `kafkajs` as a dependency where needed.
   - `shared`
   - services that produce/consume
3. Add schema governance to the platform design.
   - preferred: Schema Registry
   - choose one event format:
     - Avro
     - Protobuf
     - JSON Schema
   - define compatibility mode up front
     - usually `BACKWARD` or `FULL`
4. Expand `shared/kafka/index.ts` into a proper shared messaging module.
   - producer singleton
   - consumer factory
   - graceful shutdown helpers
   - broker/client configuration via env vars
5. Define event schemas in `shared/types`.
   - versioned payload types
   - one type per topic
   - consistent keys and timestamps
6. Define a common event envelope.

Recommended envelope:
```ts
type DomainEvent<T> = {
  eventId: string;
  eventType: string;
  eventVersion: 1;
  occurredAt: string;
  source: string;
  payload: T;
};
```

Acceptance criteria:
- Kafka boots locally with compose
- every service can connect using env config
- shared types compile without local shims doing all the work
- event contracts have a schema and compatibility rule

Recommended local-dev posture:
- start with one Kafka broker in KRaft mode
- use a single advertised internal hostname for service-to-service traffic
- defer multi-broker replication concerns until production planning

### Phase 2: Auth and Mail First
Goal: replace the most obvious synchronous side effect first.

Tasks:
1. Introduce an outbox table in `auth-service`.
   - store pending domain events in the same DB transaction as auth writes
   - include `event_id`, `event_type`, `payload`, `status`, `created_at`
2. Build an outbox publisher worker for `auth-service`.
   - polls unpublished rows
   - publishes to Kafka
   - marks rows as published
   - retries safely
3. Replace synchronous mail calls in `auth-service` with outbox-backed event creation.
   - registration OTP email
   - resend OTP email
   - forgot password email
   - optional welcome email
4. Start the mail consumer in `mail-service` runtime startup.
5. Keep the existing email logic, but invoke it from the consumer instead of direct HTTP calls.
6. Add structured logging around publish and consume outcomes.
7. Add retry handling for transient mail failures.

Acceptance criteria:
- auth-service no longer blocks on mail HTTP
- mail-service consumes `notification.email.send`
- duplicate consumer runs do not send duplicate email without protection
- event publication is not lost if the service crashes after DB commit

### Phase 3: Account Deletion Cascade
Goal: use Kafka for cross-service cleanup triggered by account deletion.

Tasks:
1. Emit `user.account.deleted` through the outbox flow from `auth-service`.
2. Start the driver consumer in `driver-service` startup.
3. Make the driver consumer idempotent.
   - deleting a missing profile must be a no-op
4. Add a future placeholder consumer in `route-service` if user-linked cleanup will be needed there.

Acceptance criteria:
- deleting a user emits one event
- driver profile cleanup happens asynchronously
- reprocessing the same event is safe

### Phase 4: Route and Booking Domain Events
Goal: publish domain events for downstream consumers without changing booking UX.

Tasks:
1. Introduce an outbox table in `route-service`.
2. Emit `route.created` from `route-service` through the outbox flow.
3. Emit `booking.confirmed` only when booking state truly transitions to confirmed.
4. Emit `notification.email.send` for passenger notifications from `route-service`.
5. Decide whether trip booking itself should emit a separate `booking.created` event before `booking.confirmed`.

Recommendation:
- Do not overload `booking.confirmed` to mean "booking exists".
- Introduce:
  - `booking.created`
  - `booking.confirmed`
  - `booking.cancelled`
if the domain is expected to grow.

Acceptance criteria:
- events are emitted from committed state changes only
- event names map cleanly to domain meaning

### Phase 5: Reliability Hardening
Goal: make async messaging safe in production.

Tasks:
1. Enable idempotent producer behavior and durable acknowledgements.
   - require producer acks from Kafka appropriately
   - configure producer for safe retries
2. Add idempotency handling for consumers.
   - store processed event IDs
   - or use deterministic upserts/deletes where possible
3. Add retries with bounded backoff.
4. Add dead-letter topics.
   - `notification.email.send.dlq`
   - `user.account.deleted.dlq`
   - others as needed
5. Add poison-message logging and metrics.
6. Add producer-side error handling and connection lifecycle management.
7. Add startup behavior rules.
   - services that require Kafka should fail fast
   - optional consumers can degrade gracefully only if explicitly intended

Acceptance criteria:
- consumers are safe against redelivery
- failed messages are inspectable
- service shutdown closes producers/consumers cleanly

### Phase 6: Testing and Observability
Goal: make Kafka behavior verifiable and debuggable.

Tasks:
1. Add unit tests for producers.
2. Add consumer tests with example payloads.
3. Add integration tests with Kafka-enabled test environment.
4. Add logs for:
   - event publish success/failure
   - event consume start/end
   - retry count
   - DLQ write
5. Add basic metrics.
   - publish count
   - consume success/failure count
   - retry count
   - DLQ count

---

## 6. Topic and Ownership Plan

| Topic | Producer | Primary Consumers | Notes |
| :--- | :--- | :--- | :--- |
| `notification.email.send` | `auth-service`, `route-service` | `mail-service` | First topic to fully implement. |
| `user.account.created` | `auth-service` | future analytics/onboarding | Optional at first. |
| `user.account.deleted` | `auth-service` | `driver-service`, future `route-service` | Must be idempotent. |
| `driver.profile.updated` | `driver-service` | future route cache/search/profile sync | Not urgent unless another service needs it. |
| `route.created` | `route-service` | future search/indexing | Useful once discovery/search is externalized. |
| `booking.confirmed` | `route-service` | future payouts/notifications | Only emit on real confirmation transition. |

---

## 7. Event Design Rules

These rules should be followed from the start:

1. Use the outbox pattern for DB-backed state changes.
2. Keep payloads small and factual.
3. Include IDs, not full aggregate state unless necessary.
4. Version every event contract.
5. Register and validate schemas centrally.
6. Use one clear domain meaning per topic.
7. Make every consumer idempotent.
8. Avoid synchronous request/response semantics over Kafka.

Recommended schema posture:
- choose one serialization format per platform
- register schemas centrally
- enforce compatibility checks before producer rollout
- use primitive/simple keys for partitioning stability

Recommended payload style:
```ts
type UserAccountDeletedV1 = DomainEvent<{
  userId: string;
}>;
```

---

## 8. Startup Wiring Plan

Each service should explicitly declare whether it is a producer, consumer, or both.

### `auth-service`
- producer only for phase 1-4
- initialize producer lazily or at startup
- create outbox records inside DB transactions
- publish from outbox worker, not inline request handlers

### `mail-service`
- consumer only
- start email consumer during service bootstrap
- keep HTTP API only if still needed for manual/admin sending

### `driver-service`
- consumer for `user.account.deleted`
- optional producer for `driver.profile.updated`
- start consumer during service bootstrap

### `route-service`
- producer for route/booking events
- no consumer required initially unless cleanup is added

### `api-gateway`
- should not produce business domain events
- may produce only operational/audit events if intentionally designed later

---

## 9. Recommended First Milestone

If the goal is to ship incrementally with low risk, implement this slice first:

1. Add Kafka in KRaft mode to `docker-compose.yml`
2. Add `kafkajs` dependency properly
3. Choose schema format and add Schema Registry to the architecture plan
4. Finalize shared event envelope/types
5. Add `auth-service` outbox table + outbox publisher worker
6. Wire `auth-service` to create `notification.email.send` outbox events
7. Wire `mail-service` consumer startup
8. Remove direct auth-to-mail HTTP dependency
9. Add tests for that flow

This gives immediate architectural value with the smallest blast radius.

---

## 10. Suggested Additions to This Document

The following sections should be maintained here as implementation proceeds:
- Event schemas
- Consumer group names
- Topic retention/DLQ rules
- Local development commands
- Failure/retry semantics
- Ownership by team/service
- Migration checklist from synchronous calls to async events
