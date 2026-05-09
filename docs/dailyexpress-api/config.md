# Config module scenarios

Module: `dailyexpress-api/config`

Config owns environment loading and required runtime settings used by the API,
Kora, Redis/Realtime, rate limiting, cookies, CORS, pg-boss, and SMTP.

## Success

- `loadConfig`/`getConfig` provide typed runtime settings to the app and service
  clients.
- API startup uses config for port, trusted proxy, CORS, cookies, and Sentry
  initialization.
- Payment/payout/driver workers use config-backed Kora and Redis settings.
- Rate limiters use config-backed Upstash credentials in production and memory
  fallback outside production when credentials are absent.

## Failure

- Missing or invalid required settings can fail fast at startup or when the
  dependent client is first created.
- Production rate limiting without required Upstash credentials throws during
  limiter setup.
- Missing payment public base URL or Kora webhook URL causes payment callback URL
  generation to fail with a controlled service error.

## Error

- Startup configuration errors are captured by Sentry, logged, and cause process
  exit.
- Runtime config-dependent provider failures bubble through controllers or
  workers according to the module that used the config value.
