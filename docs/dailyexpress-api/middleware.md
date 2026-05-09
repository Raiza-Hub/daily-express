# Middleware module scenarios

Module: `dailyexpress-api/middleware`

Middleware owns request authentication, public-path detection, rate limiting,
request logging, not-found handling, and error responses.

## Success

- `authMiddleware` validates access/refresh JWT cookies and attaches the
  canonical authenticated context to `req.user`.
- Shared route guards read `req.user` to allow authenticated or verified users.
- `publicPaths.ts` identifies public auth, route search, payment return,
  payment webhook, payout webhook, and health paths.
- `authLimiter`, `publicRoutesLimiter`, `protectedLimiter`, and
  `webhookLimiter` apply limits only to their intended path groups.
- `requestLogger` records request lifecycle information while ignoring health
  checks.
- `notFoundHandler` returns a controlled 404 for unmatched routes.
- `errorHandler` returns the shared error response shape and captures exceptions
  with Sentry context.

## Failure

- Missing/invalid auth cookies leave `req.user` unset and protected handlers
  return `401`.
- Unverified users are blocked by verified route guards.
- Public paths intentionally skip protected auth.
- Rate-limited requests receive the configured too-many-requests response.
- Unknown routes receive a controlled 404.

## Error

- JWT verification, refresh, request logging, and downstream handler exceptions
  are routed to the global error handler.
- Error responses preserve controlled status codes from service errors and use a
  generic server-error shape for unexpected failures.

