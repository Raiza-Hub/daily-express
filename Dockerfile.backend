FROM oven/bun:1.3.6-debian AS base

WORKDIR /app
ENV BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache

FROM base AS install

COPY package.json bun.lock ./
COPY api-gateway/package.json api-gateway/package.json
COPY shared/package.json shared/package.json
COPY services/auth-service/package.json services/auth-service/package.json
COPY services/driver-service/package.json services/driver-service/package.json
COPY services/mail-service/package.json services/mail-service/package.json
COPY services/notification-service/package.json services/notification-service/package.json
COPY services/payment-service/package.json services/payment-service/package.json
COPY services/payout-service/package.json services/payout-service/package.json
COPY services/route-service/package.json services/route-service/package.json
COPY email/package.json email/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY apps/drivers/package.json apps/drivers/package.json
COPY apps/web/package.json apps/web/package.json
COPY patches ./patches
COPY email ./email
COPY shared ./shared

RUN bun install \
  --frozen-lockfile \
  --production \
  --omit optional \
  --filter=api-gateway \
  --filter=auth-service \
  --filter=driver-service \
  --filter=route-service \
  --filter=payment-service \
  --filter=payout-service \
  --filter=notification-service \
  --filter=mail-service \
  --filter=shared \
  --filter=@repo/email

FROM base AS release

COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/api-gateway/node_modules ./api-gateway/node_modules
COPY --from=install /app/shared/node_modules ./shared/node_modules
COPY --from=install /app/services/auth-service/node_modules ./services/auth-service/node_modules
COPY --from=install /app/services/driver-service/node_modules ./services/driver-service/node_modules
COPY --from=install /app/services/mail-service/node_modules ./services/mail-service/node_modules
COPY --from=install /app/services/notification-service/node_modules ./services/notification-service/node_modules
COPY --from=install /app/services/payment-service/node_modules ./services/payment-service/node_modules
COPY --from=install /app/services/payout-service/node_modules ./services/payout-service/node_modules
COPY --from=install /app/services/route-service/node_modules ./services/route-service/node_modules
COPY --from=install /app/email/node_modules ./email/node_modules
COPY package.json bun.lock ./
COPY api-gateway ./api-gateway
COPY email ./email
COPY shared ./shared
COPY services ./services
COPY scripts ./scripts
COPY turbo.json tsconfig.json ./

ENV PATH="/app/node_modules/.bin:${PATH}"
USER bun

CMD ["sh", "-lc", "bun run --cwd \"${SERVICE_PATH:?Set SERVICE_PATH for this Railway service}\" start"]
