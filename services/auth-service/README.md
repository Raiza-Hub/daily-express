# auth-service

To install dependencies:

```bash
bun install
```

Before starting the service, make sure `INTERNAL_SERVICE_TOKEN` is set in
`services/auth-service/.env` and matches the value used by
`api-gateway/.env`. The API gateway uses this shared token for
`/v1/auth/internal/users/:id/session`, and session refresh will fail if the
values do not match.

Auth sessions are stored in Upstash Redis. Set
`SESSION_UPSTASH_REDIS_REST_URL` and `SESSION_UPSTASH_REDIS_REST_TOKEN` in the
auth service environment. The older `AUTH_UPSTASH_REDIS_REST_*` names and the
generic `UPSTASH_REDIS_REST_*` names are also supported as fallbacks.

To run:

```bash
bun run dev
```

This project was created using `bun init` in bun v1.3.6. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
