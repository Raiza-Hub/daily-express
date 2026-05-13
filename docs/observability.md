# Daily Express Observability Stack

This local stack runs Postgres, `dailyexpress-api`, and Metabase by default.
Appsmith stays configured in Docker Compose for action workflows, but it is
opt-in so the default stack uses less memory. The stack does not start any
legacy `services/*` containers.
Startup uses Docker Compose `--remove-orphans` so old stopped containers from
the previous full backend Compose setup do not keep showing in Docker Desktop.

## Start

```bash
bun run observability:up
```

URLs:

- Appsmith: <http://localhost:8080>
- Metabase: <http://localhost:3002>
- DailyExpress API: <http://localhost:8000>

Appsmith does not start by default. Start it only when you need action workflow
pages:

```bash
bun run observability:appsmith:up
```

## Database Access

Use this datasource in Appsmith and as the analytics database in Metabase:

- Host: `db`
- Port: `5432`
- Database: `dailyexpress_api`
- User: `dailyexpress_readonly`
- Password: `dailyexpress_readonly_dev` unless `DAILYEXPRESS_READONLY_DB_PASSWORD` is set
- SSL: disabled locally

Metabase stores its own users, questions, dashboards, and settings in:

- Host: `db`
- Port: `5432`
- Database: `dailyexpress_metabase`
- User: `metabase_app`
- Password: `metabase_app_dev` unless `METABASE_APP_DB_PASSWORD` is set

## Commands

```bash
bun run observability:up
bun run observability:down
bun run observability:logs
bun run observability:appsmith:up
bun run observability:appsmith:down
bun run observability:db-access
```

`observability:db-access` is useful when the local Docker Postgres volume already
exists. Docker only runs files in `/docker-entrypoint-initdb.d` on a fresh volume,
so this command reapplies the read-only role, Metabase app database, and grants.

## Intended Use

Appsmith can read failed payments, payout failures, webhook records, and driver
manual-review data from Postgres. Sensitive actions such as retrying payouts,
releasing payouts, or refund retries should be implemented later through
admin-only `dailyexpress-api` endpoints, not direct SQL writes.

Metabase should be used for analytics dashboards such as payment status counts,
payout retry backlog, manual review backlog, failed webhook counts, and money at
risk.

For Appsmith REST API datasources, use:

- Base URL inside Docker: `http://dailyexpress-api:8000`
- Base URL from the browser/host: `http://localhost:8000`
