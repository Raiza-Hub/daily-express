# Deploying Daily Express to Railway and Confluent Cloud

This guide deploys the Daily Express backend services to Railway and uses Confluent Cloud for Kafka and Schema Registry.

Official references:

- Railway monorepo deployments: https://docs.railway.com/guides/monorepo
- Railway Dockerfile deployments: https://docs.railway.com/deploy/dockerfiles
- Railway variables: https://docs.railway.com/variables
- Railway private networking: https://docs.railway.com/private-networking
- Confluent Cloud Schema Registry quick start: https://docs.confluent.io/cloud/current/get-started/schema-registry.html
- Confluent Cloud API keys: https://docs.confluent.io/cloud/current/security/authenticate/workload-identities/service-accounts/api-keys/manage-api-keys.html

## Architecture

Deploy these Railway services from the same repository:

| Railway service        | Start command                                          | Public? | Health check          |
| ---------------------- | ------------------------------------------------------ | ------- | --------------------- |
| `api-gateway`          | `bun --cwd api-gateway src/index.ts`                   | Yes     | `/health`             |
| `auth-service`         | `bun --cwd services/auth-service run start`            | No      | `/health`             |
| `driver-service`       | `bun --cwd services/driver-service run start`          | No      | `/health`             |
| `route-service`        | `bun --cwd services/route-service run start`           | No      | `/health`             |
| `payment-service`      | `bun --cwd services/payment-service run start`         | No      | `/v1/payments/health` |
| `payout-service`       | `bun --cwd services/payout-service run start`          | No      | `/v1/payouts/health`  |
| `notification-service` | `bun --cwd services/notification-service run start`    | No      | `/v1/health`          |
| `mail-service`         | `bun --cwd services/mail-service run start`            | No      | `/health`             |

The API gateway is the only backend service that needs a public Railway domain. The other services should be reached over Railway private networking with `*.railway.internal` URLs.

## 1. Prepare Confluent Cloud

1. Create a Confluent Cloud environment and Kafka cluster.
2. Enable Schema Registry in the same environment.
3. Create a Kafka API key and secret for the Kafka cluster.
4. Create a separate Schema Registry API key and secret. Confluent uses separate keys for Kafka and Schema Registry.
5. Copy these values:

```env
KAFKA_BROKERS=<bootstrap-server-host>:9092
KAFKA_API_KEY=<kafka-api-key>
KAFKA_API_SECRET=<kafka-api-secret>
SCHEMA_REGISTRY_URL=https://<schema-registry-endpoint>
SCHEMA_REGISTRY_API_KEY=<schema-registry-api-key>
SCHEMA_REGISTRY_API_SECRET=<schema-registry-api-secret>
```

For Confluent Cloud, also set:

```env
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_TOPIC_PARTITIONS=1
```

## 2. Create Railway Project Services

1. Create an empty Railway project.
2. Add one Railway service for each backend service listed in the architecture table.
3. Connect every service to this GitHub repository.
4. Leave the root directory as the repository root because this is a shared Bun monorepo.
5. Set the custom Dockerfile path on every backend service:

```env
RAILWAY_DOCKERFILE_PATH=Dockerfile.backend
```

6. Set each service's start command from the architecture table.
7. Only generate a public domain for `api-gateway`. Keep the other backend services private.

## 3. Provision PostgreSQL

The local Docker setup uses separate databases:

- `dailyExpress_auth`
- `dailyExpress_drivers`
- `dailyExpress_route`
- `dailyExpress_payment`
- `dailyExpress_payout`
- `dailyExpress_notifications`

Recommended Railway setup: create one Railway Postgres service per stateful backend. Then set that Postgres service's `DATABASE_URL` on the matching app service:

| App service            | Needs `DATABASE_URL` |
| ---------------------- | -------------------- |
| `auth-service`         | Yes                  |
| `driver-service`       | Yes                  |
| `route-service`        | Yes                  |
| `payment-service`      | Yes                  |
| `payout-service`       | Yes                  |
| `notification-service` | Yes                  |
| `mail-service`         | No                   |
| `api-gateway`          | No                   |

If you use one shared Railway Postgres instance instead, create the six databases manually and give each service a `DATABASE_URL` pointing at its own database. The route database also needs:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

## 4. Configure Shared Railway Variables

Create these as shared variables or duplicate them across the backend services that need them:

```env
NODE_ENV=production
INTERNAL_SERVICE_TOKEN=<long-random-secret>
JWT_SECRET=<long-random-secret-at-least-32-chars>
JWT_REFRESH_SECRET=<long-random-secret-at-least-32-chars>
SESSION_SECRET=<long-random-secret>

KAFKA_BROKERS=<confluent-bootstrap-host>:9092
KAFKA_SSL=true
KAFKA_SASL_MECHANISM=plain
KAFKA_API_KEY=<kafka-api-key>
KAFKA_API_SECRET=<kafka-api-secret>
SCHEMA_REGISTRY_URL=https://<schema-registry-endpoint>
SCHEMA_REGISTRY_API_KEY=<schema-registry-api-key>
SCHEMA_REGISTRY_API_SECRET=<schema-registry-api-secret>
KAFKA_TOPIC_PARTITIONS=1

COOKIE_DOMAIN=.dailyexpress.app
CORS_ORIGINS=https://dailyexpress.app,https://driver.dailyexpress.app
FRONTEND_URL=https://dailyexpress.app
WEB_APP_URL=https://dailyexpress.app
DRIVER_APP_URL=https://driver.dailyexpress.app
NEXT_PUBLIC_WEB_APP_URL=https://dailyexpress.app
NEXT_PUBLIC_DRIVER_APP_URL=https://driver.dailyexpress.app
NEXT_PUBLIC_API_GATEWAY_URL=https://<api-gateway-public-domain>
ROUTE_SERVICE_TIMEZONE=Africa/Lagos

SENTRY_DSN=
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=
SENTRY_ENABLE_LOGS=true
SENTRY_TRACES_SAMPLE_RATE=1
SENTRY_SEND_DEFAULT_PII=true
```

Set `SERVICE_NAME` per service so DLQ and idempotency logs are easier to trace:

```env
SERVICE_NAME=auth-service
```

Use each service's actual name for the value.

## 5. Configure Service-Specific Variables

### API Gateway

Use Railway private DNS for upstream services:

```env
PORT=<let Railway provide this unless you need a fixed port>
TRUST_PROXY_HOPS=1
AUTH_SERVICE_URL=http://auth-service.railway.internal:5001
DRIVER_SERVICE_URL=http://driver-service.railway.internal:5002
ROUTE_SERVICE_URL=http://route-service.railway.internal:5004
PAYMENT_SERVICE_URL=http://payment-service.railway.internal:5005
PAYOUT_SERVICE_URL=http://payout-service.railway.internal:5006
NOTIFICATION_SERVICE_URL=http://notification-service.railway.internal:5007
RATE_LIMIT_UPSTASH_REDIS_REST_URL=<upstash-rest-url>
RATE_LIMIT_UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>
```

### Auth Service

```env
PORT=5001
DATABASE_URL=<auth-postgres-url>
GOOGLE_CLIENT_ID=<google-client-id>
GOOGLE_CLIENT_SECRET=<google-client-secret>
GOOGLE_CALLBACK_URL=https://<api-gateway-public-domain>/api/auth/v1/auth/google/callback
SESSION_UPSTASH_REDIS_REST_URL=<upstash-rest-url>
SESSION_UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>
EMAIL_BRAND_NAME=Daily Express
SUPPORT_EMAIL=support@dailyexpress.app
```

### Driver Service

```env
PORT=5002
DATABASE_URL=<driver-postgres-url>
AUTH_SERVICE_URL=http://auth-service.railway.internal:5001
CLOUDINARY_CLOUD_NAME=<cloudinary-cloud-name>
CLOUDINARY_API_KEY=<cloudinary-api-key>
CLOUDINARY_SECRET_KEY=<cloudinary-secret-key>
```

### Route Service

```env
PORT=5004
DATABASE_URL=<route-postgres-url>
DRIVER_SERVICE_URL=http://driver-service.railway.internal:5002
```

### Payment Service

```env
PORT=5005
DATABASE_URL=<payment-postgres-url>
KORA_SECRET_KEY=<kora-secret-key>
KORA_WEBHOOK_SECRET=<kora-webhook-secret>
KORA_WEBHOOK_URL=https://<api-gateway-public-domain>/api/payments/v1/payments/webhooks/kora
PAYMENT_PUBLIC_BASE_URL=https://<api-gateway-public-domain>/api/payments
FRONTEND_URL=https://dailyexpress.app
```

### Payout Service

```env
PORT=5006
DATABASE_URL=<payout-postgres-url>
KORA_SECRET_KEY=<kora-secret-key>
KORA_WEBHOOK_SECRET=<kora-webhook-secret>
```

### Notification Service

```env
PORT=5007
DATABASE_URL=<notification-postgres-url>
VAPID_PUBLIC_KEY=<vapid-public-key>
VAPID_PRIVATE_KEY=<vapid-private-key>
VAPID_SUBJECT=mailto:support@dailyexpress.app
NOTIFICATION_UPSTASH_REDIS_REST_URL=<upstash-rest-url>
NOTIFICATION_UPSTASH_REDIS_REST_TOKEN=<upstash-rest-token>
```

### Mail Service

```env
PORT=3008
EMAIL_FROM=noreply@dailyexpress.app
SMTP_HOST=<smtp-host>
SMTP_PORT=587
SMTP_USERNAME=<smtp-username>
SMTP_PASSWORD=<smtp-password>
FRONTEND_URL=https://dailyexpress.app
```

## 6. Run Database Setup

Run Drizzle setup once per database-backed service after its `DATABASE_URL` is set.

From the Railway CLI, link to the target service and run:

```bash
railway run bun --cwd services/auth-service x drizzle-kit push
railway run bun --cwd services/driver-service x drizzle-kit push
railway run bun --cwd services/route-service x drizzle-kit push
railway run bun --cwd services/payment-service x drizzle-kit push
railway run bun --cwd services/payout-service x drizzle-kit push
railway run bun --cwd services/notification-service x drizzle-kit push
```

If you prefer one-off Railway services, create a temporary service with the same repository, Dockerfile, and environment variables, then use the same commands as the start command.

## 7. Create Kafka Topics and Register Schemas

Create a one-off Railway service or run this with Railway CLI using the Confluent env vars:

```bash
railway run bun run kafka:init-topics
```

This creates all event topics and DLQ topics from `shared/kafka/index.ts`. The first producer that emits each event also registers its Avro schema in Schema Registry.

If the Confluent principal cannot create topics, create these topics manually in Confluent Cloud:

```text
notification.email.send
user.account.created
user.account.deleted
driver.identity.created
driver.identity.updated
driver.identity.deleted
driver.payout_profile.upserted
driver.payout_profile.deleted
user.identity.upserted
route.created
route.deleted
booking.confirmed
booking.cancelled
trip.completed
trip.cancelled
payment.completed
payment.failed
payout.completed
payout.failed
driver.bank.verification.requested
driver.bank.verified
driver.bank.verification.failed
notification-service.dlq
```

Also create a `.dlq` topic for each event topic, for example `payment.completed.dlq`.

## 8. Deploy Order

Deploy in this order:

1. Postgres services.
2. Confluent Cloud cluster and Schema Registry.
3. Database setup commands.
4. Kafka topic setup command.
5. Internal services: auth, driver, route, payment, payout, notification, mail.
6. `api-gateway`.
7. Frontend apps after `NEXT_PUBLIC_API_GATEWAY_URL` points at the gateway domain.

## 9. Verify

Check public gateway health:

```bash
curl https://<api-gateway-public-domain>/health
```

Check private service health from Railway shell or a temporary diagnostic service:

```bash
curl http://auth-service.railway.internal:5001/health
curl http://driver-service.railway.internal:5002/health
curl http://route-service.railway.internal:5004/health
curl http://payment-service.railway.internal:5005/v1/payments/health
curl http://payout-service.railway.internal:5006/v1/payouts/health
curl http://notification-service.railway.internal:5007/v1/health
curl http://mail-service.railway.internal:3008/health
```

In Confluent Cloud, verify:

- Consumer groups appear for the services.
- Event topics exist.
- Avro subjects appear in Schema Registry after events are produced.
- DLQ topics stay empty during healthy flows.

## 10. Production Notes

- Do not expose internal services publicly unless you need temporary debugging.
- Rotate Confluent, Kora, SMTP, Google, Cloudinary, Upstash, and JWT secrets before launch.
- Keep Kafka and Schema Registry API keys separate.
- Use Railway shared variables for common secrets, but keep `DATABASE_URL`, `PORT`, and `SERVICE_NAME` service-scoped.
- Use `TRUST_PROXY_HOPS=1` behind Railway for the API gateway.
- Configure Kora and Google callback URLs with the final API gateway custom domain, not a temporary Railway domain.
- Watch service logs during first deploy; most startup failures will be missing env vars, database connection issues, or Kafka auth errors.
