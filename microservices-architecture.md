# Microservices Architecture — Daily Express

## Overview

The **daily-express** project is a ride/transport marketplace with two frontends:

- `apps/web` — Passenger-facing app (search trips, book, view status)
- `apps/drivers` — Driver dashboard (manage routes, view payouts, onboard)

Currently all data is hardcoded/mocked in the frontends. This guide breaks the backend into independently deployable microservices — **one database per service** — arranged inside the existing Turborepo monorepo.

**Infrastructure stack:** PostgreSQL · MongoDB · Elasticsearch · Apache Kafka · Redis

---

## The 7 Microservices

### 1. `auth-service`
Handles registration, login, OTP, password reset, and JWT/session issuance.

**Owns:**
- Users (email, hashed password, roles: `passenger` | `driver`)
- OTP tokens
- Refresh tokens / sessions

**Database:** PostgreSQL — `auth_db`

---

### 2. `user-service`
Handles profiles for both passengers and drivers, including onboarding data.

**Owns:**
- Driver profiles (name, photo, phone, country, address, bank details)
- Passenger profiles
- Onboarding status

**Database:** PostgreSQL — `user_db`

> Communicates with `auth-service` to validate identity. Does **not** store passwords.

---

### 3. `route-service`
Manages routes created and published by drivers.

**Owns:**
- Routes (departure city, arrival city, meeting point, vehicle type, seat count, price, schedule times)
- Route status (active / disabled)

**Database:** PostgreSQL — `route_db`

---

### 4. `booking-service`
Handles passengers searching for trips and making bookings.

**Owns:**
- Bookings (passenger ID, route ID, seat count, status: `pending` | `confirmed` | `cancelled`)
- Seat availability (derived from route seat count minus confirmed bookings)
- Trip status from the passenger's perspective

**Database:** PostgreSQL — `booking_db`

> Reads route data by calling `route-service`. Seat availability is calculated here, **not** in `route-service`.

---

### 5. `payout-service`
Handles driver earnings, payout requests, and transaction history.

**Owns:**
- Payout records (driver ID, amount, settled amount, date, status: `pending` | `done` | `failed`)
- Transaction fee records (currently 10% per booking)
- Bank account validation

**Database:** PostgreSQL — `payout_db`

> Consumes Kafka topic `booking.confirmed` to trigger earning records.

---

### 6. `notification-service`
Handles in-app and push notifications.

**Owns:**
- Notification records (recipient ID, type, message, read status)
- Push/email delivery logs

**Database:** PostgreSQL — `notification_db`

> Subscribes to Kafka events from all other services (new booking, payout done, route update, etc.).

---

### 7. `search-service`
Powers the trip/route search experience on `apps/web`. Maintains a denormalized, always-up-to-date Elasticsearch index synced from `route-service` via Kafka.

**Owns:**
- Elasticsearch index `routes` — denormalized route documents (departure city, arrival city, departure time, price, seats available, vehicle type)
- Search logic: full-text + filtered queries (city name, date, price range)

**Database:** Elasticsearch — `routes` index

> Consumes Kafka topics `route.created`, `route.updated`, `route.deleted`, and `booking.confirmed` (to decrement available seats in the index). Never writes to any other service's DB.

---

## Folder Structure

Place all microservices inside a new `services/` folder at the monorepo root, alongside `apps/` and `packages/`.

```
daily-express/
├── apps/
│   ├── web/                        # Passenger Next.js frontend
│   └── drivers/                    # Driver Next.js frontend
│
├── packages/
│   ├── ui/                         # Shared UI components
│   ├── types/                      # Shared Zod schemas & TypeScript types
│   ├── typescript-config/
│   └── eslint-config/
│
├── services/                       # ← NEW: all microservices go here
│   ├── auth-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── middleware/
│   │   │   ├── models/
│   │   │   └── index.ts
│   │   ├── prisma/schema.prisma
│   │   ├── .env
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── user-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── models/
│   │   │   └── index.ts
│   │   ├── prisma/schema.prisma
│   │   ├── .env
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── route-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── models/
│   │   │   ├── events/             # Kafka producers (route.created, route.updated, route.deleted)
│   │   │   └── index.ts
│   │   ├── prisma/schema.prisma
│   │   ├── .env
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── booking-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── models/
│   │   │   ├── events/             # Kafka producers (booking.confirmed, booking.cancelled)
│   │   │   └── index.ts
│   │   ├── prisma/schema.prisma
│   │   ├── .env
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── payout-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── models/
│   │   │   ├── events/             # Kafka consumer (booking.confirmed)
│   │   │   └── index.ts
│   │   ├── prisma/schema.prisma
│   │   ├── .env
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   ├── notification-service/
│   │   ├── src/
│   │   │   ├── controllers/
│   │   │   ├── routes/
│   │   │   ├── models/
│   │   │   ├── events/             # Kafka consumers (all topics)
│   │   │   └── index.ts
│   │   ├── prisma/schema.prisma
│   │   ├── .env
│   │   ├── Dockerfile
│   │   └── package.json
│   │
│   └── search-service/             # ← NEW
│       ├── src/
│       │   ├── controllers/
│       │   ├── routes/
│       │   ├── elasticsearch/
│       │   │   ├── client.ts       # Elasticsearch client setup
│       │   │   ├── indices.ts      # Index mappings & settings
│       │   │   └── queries.ts      # Search query builders
│       │   ├── events/             # Kafka consumers (route.*, booking.confirmed)
│       │   └── index.ts
│       ├── .env
│       ├── Dockerfile
│       └── package.json
│
├── gateway/                        # ← NEW: API Gateway
│   ├── src/
│   │   ├── routes/                 # Proxy rules per service
│   │   └── index.ts
│   ├── Dockerfile
│   └── package.json
│
├── turbo.json
├── package.json
└── docker-compose.yml              # ← NEW: run everything locally
```

---

## API Gateway

All frontends talk to a **single API Gateway** — never directly to individual services.

**Recommended:** [Elysia](https://elysiajs.com/) with a proxy plugin, or [Express http-proxy-middleware](https://github.com/chimurai/http-proxy-middleware)

**Routing table:**

| Prefix | Proxies to |
|---|---|
| `/api/auth/**` | `auth-service:3001` |
| `/api/users/**` | `user-service:3002` |
| `/api/routes/**` | `route-service:3003` |
| `/api/bookings/**` | `booking-service:3004` |
| `/api/payouts/**` | `payout-service:3005` |
| `/api/notifications/**` | `notification-service:3006` |
| `/api/search/**` | `search-service:3007` |

The gateway also handles:
- JWT verification (forward decoded user to downstream services via headers)
- Rate limiting
- CORS

---

## Inter-Service Communication

| Style | When to use |
|---|---|
| **REST (HTTP)** | Synchronous reads — e.g., `booking-service` fetching seat count from `route-service` |
| **Kafka (events)** | Async side-effects — e.g., update search index when a route changes |

### Apache Kafka — Event Bus

Kafka is the central nervous system of the architecture. Every significant state change is published as an event to a Kafka **topic**. Any service that cares about that event subscribes independently — producers and consumers are fully decoupled.

**Kafka topics & their consumers:**

| Topic | Producer | Consumer(s) |
|---|---|---|
| `route.created` | `route-service` | `search-service` |
| `route.updated` | `route-service` | `search-service`, `notification-service` |
| `route.deleted` | `route-service` | `search-service` |
| `booking.confirmed` | `booking-service` | `payout-service`, `notification-service`, `search-service` |
| `booking.cancelled` | `booking-service` | `payout-service`, `notification-service`, `search-service` |
| `payout.completed` | `payout-service` | `notification-service` |

**Node.js Kafka client:** [`kafkajs`](https://kafka.js.org/) — works with Bun.

```ts
// Example: route-service publishing an event
import { Kafka } from 'kafkajs';

const kafka = new Kafka({ brokers: [process.env.KAFKA_BROKER!] });
const producer = kafka.producer();

await producer.send({
  topic: 'route.created',
  messages: [{ value: JSON.stringify(route) }],
});
```

```ts
// Example: search-service consuming route events
const consumer = kafka.consumer({ groupId: 'search-service' });
await consumer.subscribe({ topics: ['route.created', 'route.updated', 'route.deleted'] });
await consumer.run({
  eachMessage: async ({ topic, message }) => {
    const route = JSON.parse(message.value!.toString());
    if (topic === 'route.created') await indexRoute(route);
    if (topic === 'route.updated') await updateRouteIndex(route);
    if (topic === 'route.deleted') await deleteFromIndex(route.id);
  },
});
```

---

## Technology Stack (per service)

Each service is a standalone **Node.js / Bun** HTTP server.

| Concern | Choice |
|---|---|
| **Runtime** | Bun (already used in monorepo) |
| **Framework** | [Elysia](https://elysiajs.com/) — Bun-native, type-safe, fast |
| **ORM** | [Prisma](https://www.prisma.io/) for all PostgreSQL services |
| **Validation** | Zod (already in `packages/types`) |
| **Auth tokens** | JWT (`@elysiajs/jwt`) |
| **Event streaming** | [Apache Kafka](https://kafka.apache.org/) via [`kafkajs`](https://kafka.js.org/) |
| **Search** | [Elasticsearch](https://www.elastic.co/) via [`@elastic/elasticsearch`](https://www.npmjs.com/package/@elastic/elasticsearch) |
| **Databases** | PostgreSQL (all 6 services) + Elasticsearch (search) |

---

## Databases — One Per Service

| Service | Database | DB Name / Index |
|---|---|---|
| `auth-service` | PostgreSQL | `auth_db` |
| `user-service` | PostgreSQL | `user_db` |
| `route-service` | PostgreSQL | `route_db` |
| `booking-service` | PostgreSQL | `booking_db` |
| `payout-service` | PostgreSQL | `payout_db` |
| `notification-service` | PostgreSQL | `notification_db` |
| `search-service` | Elasticsearch | `routes` index |

> **Rule:** services never share a database or query each other's DB directly. Cross-service data is fetched via HTTP or consumed from Kafka.

---

## Shared Packages

The existing `packages/` workspace is the right place for code shared across services.

| Package | What to put there |
|---|---|
| `packages/types` | Zod schemas + TypeScript types (already here — expand per domain) |
| `packages/errors` | **NEW** — shared HTTP error classes (`NotFoundError`, `UnauthorizedError`, etc.) |
| `packages/logger` | **NEW** — shared structured logger (wrapping `pino`) |
| `packages/events` | **NEW** — Kafka topic name constants + TypeScript payload types (prevents typos across services) |

---

## Authentication Flow

Authentication uses **HTTP-only cookies** storing a signed JWT. The cookie is set on `.dailyexpress.app` so it is automatically shared across:

- `dailyexpress.app` — passenger app
- `drivers.dailyexpress.app` — driver dashboard

### Why this works across subdomains

Setting `domain=.dailyexpress.app` (leading dot) tells the browser to send the cookie to all subdomains. Both frontends hit the same API gateway, which validates the cookie before proxying to any service.

### Login flow

```
1. POST /api/auth/login  →  auth-service validates credentials
2. auth-service signs a JWT and responds with:
   Set-Cookie: session=<JWT>; HttpOnly; Secure; SameSite=Lax;
               Domain=.dailyexpress.app; Path=/; MaxAge=604800
3. Browser stores the cookie and sends it automatically on every
   subsequent request to *.dailyexpress.app
4. API Gateway reads the cookie, verifies the JWT signature,
   then forwards x-user-id and x-user-role headers downstream
5. Microservices trust those headers — they never touch the cookie
```

> **SameSite=Lax** (not Strict) is required here because `Strict` blocks the cookie when navigating between `dailyexpress.app` and `drivers.dailyexpress.app`. `Lax` still blocks cross-site POST requests, so CSRF protection is maintained.

### Elysia implementation (`auth-service`)

```ts
import { Elysia } from 'elysia';
import { cookie } from '@elysiajs/cookie';
import { jwt } from '@elysiajs/jwt';

const app = new Elysia()
  .use(jwt({ secret: process.env.JWT_SECRET! }))
  .use(cookie())
  .post('/login', async ({ jwt, setCookie, body }) => {
    // validate credentials, fetch user...
    const token = await jwt.sign({ userId: user.id, role: user.role });
    setCookie('session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      domain: process.env.COOKIE_DOMAIN, // '.dailyexpress.app' in production
      maxAge: 60 * 60 * 24 * 7,          // 7 days
      path: '/',
    });
    return { ok: true };
  })
  .post('/logout', ({ setCookie }) => {
    setCookie('session', '', { maxAge: 0, path: '/' });
    return { ok: true };
  });
```

### Local development note

In development, both apps run on `localhost` (different ports), so `domain` must be omitted or set to `localhost` — the subdomain trick only applies in production.

```env
# .env (auth-service)
COOKIE_DOMAIN=.dailyexpress.app   # production
# COOKIE_DOMAIN=                  # omit for localhost in dev
```

---

## Local Development with Docker Compose

Add a `docker-compose.yml` at the monorepo root to spin up all infrastructure and services in one command.

```yaml
# docker-compose.yml (simplified)
services:

  # ── Databases ─────────────────────────────────────
  postgres-auth:
    image: postgres:16
    environment: { POSTGRES_DB: auth_db, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    ports: ["5432:5432"]

  postgres-user:
    image: postgres:16
    environment: { POSTGRES_DB: user_db, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    ports: ["5433:5432"]

  postgres-route:
    image: postgres:16
    environment: { POSTGRES_DB: route_db, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    ports: ["5434:5432"]

  postgres-booking:
    image: postgres:16
    environment: { POSTGRES_DB: booking_db, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    ports: ["5435:5432"]

  postgres-payout:
    image: postgres:16
    environment: { POSTGRES_DB: payout_db, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    ports: ["5436:5432"]

  postgres-notification:
    image: postgres:16
    environment: { POSTGRES_DB: notification_db, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
    ports: ["5437:5432"]

  # ── Kafka ─────────────────────────────────────────
  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    ports: ["2181:2181"]

  kafka:
    image: confluentinc/cp-kafka:7.6.0
    depends_on: [zookeeper]
    ports: ["9092:9092"]
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1

  # ── Elasticsearch ─────────────────────────────────
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.13.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports: ["9200:9200"]
    volumes:
      - es-data:/usr/share/elasticsearch/data

  # ── Services ──────────────────────────────────────
  auth-service:
    build: ./services/auth-service
    ports: ["3001:3001"]
    depends_on: [postgres-auth, kafka]
    env_file: ./services/auth-service/.env

  user-service:
    build: ./services/user-service
    ports: ["3002:3002"]
    depends_on: [postgres-user, kafka]
    env_file: ./services/user-service/.env

  route-service:
    build: ./services/route-service
    ports: ["3003:3003"]
    depends_on: [postgres-route, kafka]
    env_file: ./services/route-service/.env

  booking-service:
    build: ./services/booking-service
    ports: ["3004:3004"]
    depends_on: [postgres-booking, kafka]
    env_file: ./services/booking-service/.env

  payout-service:
    build: ./services/payout-service
    ports: ["3005:3005"]
    depends_on: [postgres-payout, kafka]
    env_file: ./services/payout-service/.env

  notification-service:
    build: ./services/notification-service
    ports: ["3006:3006"]
    depends_on: [postgres-notification, kafka]
    env_file: ./services/notification-service/.env

  search-service:
    build: ./services/search-service
    ports: ["3007:3007"]
    depends_on: [elasticsearch, kafka]
    env_file: ./services/search-service/.env

  gateway:
    build: ./gateway
    ports: ["8000:8000"]
    depends_on:
      - auth-service
      - user-service
      - route-service
      - booking-service
      - payout-service
      - notification-service
      - search-service

volumes:
  es-data:
```

Run everything:
```bash
docker-compose up --build
```

---

## Turbo Pipeline (updates to `turbo.json`)

Add `services/*` to the Turbo workspace so `bun run dev` spins up all services alongside the frontends.

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    }
  }
}
```

The `package.json` workspaces field already covers `apps/*` — add `services/*`:

```json
"workspaces": [
  "apps/*",
  "packages/*",
  "services/*"
]
```

---

## Implementation Order (Recommended)

Build in this order — each service unblocks the next:

1. **Infrastructure first** — get Kafka, all PostgreSQL instances, MongoDB, and Elasticsearch running via Docker Compose
2. **`auth-service`** — everything else depends on knowing who the user is
3. **`user-service`** — driver onboarding (UI schema already exists)
4. **`route-service`** — drivers create routes; publishes `route.*` Kafka events
5. **`search-service`** — consumes `route.*` events, indexes into Elasticsearch; enables trip search in `apps/web`
6. **`booking-service`** — passengers book; publishes `booking.*` Kafka events
7. **`payout-service`** — consumes `booking.confirmed` to create earnings records
8. **`notification-service`** — last, only consumes events from all the above

---

## `.env` Keys You'll Need Per Service

### `auth-service`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/auth_db
JWT_SECRET=your-secret-here
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
PORT=3001
```

### `user-service`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/user_db
AUTH_SERVICE_URL=http://localhost:3001
PORT=3002
```

### `route-service`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/route_db
KAFKA_BROKER=localhost:9092
PORT=3003
```

### `booking-service`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5435/booking_db
ROUTE_SERVICE_URL=http://localhost:3003
KAFKA_BROKER=localhost:9092
PORT=3004
```

### `payout-service`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5436/payout_db
KAFKA_BROKER=localhost:9092
PORT=3005
```

### `notification-service`
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5437/notification_db
KAFKA_BROKER=localhost:9092
PORT=3006
```

### `search-service`
```env
ELASTICSEARCH_URL=http://localhost:9200
KAFKA_BROKER=localhost:9092
PORT=3007
```

### `gateway`
```env
JWT_SECRET=your-secret-here
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
ROUTE_SERVICE_URL=http://localhost:3003
BOOKING_SERVICE_URL=http://localhost:3004
PAYOUT_SERVICE_URL=http://localhost:3005
NOTIFICATION_SERVICE_URL=http://localhost:3006
SEARCH_SERVICE_URL=http://localhost:3007
PORT=8000
```

---

## Updating the Frontends

Once services are live, replace the hardcoded mock data in the frontends with real API calls. Since both `apps/web` and `apps/drivers` are Next.js, use:
- **Server Components** → `fetch()` directly on the server
- **Client Components** → [TanStack Query](https://tanstack.com/query) or SWR for data fetching + caching

All requests go through the gateway: `http://localhost:8000/api/...`

### What changes in each frontend

**`apps/web` (passenger app)**
- `TripSearchBar` → `GET /api/search?from=Lagos&to=Abuja&date=2026-03-01` — powered by Elasticsearch
- `TripCard` / `TripDetailsSheet` → `GET /api/bookings/:id` — from `booking-service`
- `TripStatusCard` → `GET /api/bookings?passengerId=...` — booking history

**`apps/drivers` (driver dashboard)**
- `RouteCard` → `GET /api/routes?driverId=...` — from `route-service`
- `CreateRouteDialog` / `EditRouteSheet` → `POST /api/routes`, `PATCH /api/routes/:id`
- `PayoutTable` → `GET /api/payouts?driverId=...` — from `payout-service`
- `ProfitCalendar` → `GET /api/payouts/summary?driverId=...&week=...`
- `NotificationInbox` → `GET /api/notifications?userId=...` — from `notification-service`
