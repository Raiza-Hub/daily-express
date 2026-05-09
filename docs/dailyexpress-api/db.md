# Database module scenarios

Module: `dailyexpress-api/db`

The DB module owns shared PostgreSQL connection setup and Drizzle table exports
for auth, driver, route, payment, payout, and notification data.

## Success

- `connection.ts` creates the Postgres.js client with the configured pool and
  exports a Drizzle database bound to the shared schema.
- `db/index.ts` re-exports all table schemas so application modules use one
  shared database model.
- Service methods use Drizzle queries and explicit `db.transaction` blocks for
  multi-row critical state changes.
- Transaction-scoped job insertion writes directly into pg-boss tables so jobs
  commit with related state.

## Failure

- Constraint failures are sometimes converted to business responses, such as
  duplicate routes or active booking conflicts.
- Missing records are handled by service-layer checks and usually become `404`,
  `400`, `401`, or `403` responses depending on context.
- If any statement in a transaction fails, all writes in that transaction roll
  back.

## Error

- Connection, query, migration/schema mismatch, serialization, and transaction
  errors bubble to the caller.
- HTTP callers pass DB errors to the global error handler.
- Worker callers rethrow DB errors so pg-boss can retry or DLQ the job.
