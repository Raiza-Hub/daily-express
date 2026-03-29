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
- **Zookeeper**: Manages Kafka cluster state.
- **Kafka**: The event streaming platform.

> [!TIP]
> Use `kafkajs` for the Node.js/Bun implementation across all services.
