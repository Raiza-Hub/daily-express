FROM oven/bun:1.3.6-debian AS base

WORKDIR /app
ENV BUN_INSTALL_CACHE_DIR=/root/.bun/install/cache

FROM base AS install

COPY package.json bun.lock ./
COPY apps/web/package.json apps/web/package.json
COPY apps/drivers/package.json apps/drivers/package.json
COPY email/package.json email/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY shared/package.json shared/package.json
COPY dailyexpress-api/package.json dailyexpress-api/package.json

RUN bun install \
  --frozen-lockfile \
  --production \
  --omit optional \
  --filter=@dailyexpress-api

FROM base AS release

COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/shared/node_modules ./shared/node_modules
COPY --from=install /app/dailyexpress-api/node_modules ./dailyexpress-api/node_modules
COPY --from=install /app/email/node_modules ./email/node_modules
COPY package.json bun.lock ./
COPY dailyexpress-api ./dailyexpress-api
COPY shared ./shared
COPY email ./email
COPY scripts ./scripts
COPY turbo.json tsconfig.json ./

ENV PATH="/app/node_modules/.bin:${PATH}"

CMD ["bun", "run", "--cwd", "dailyexpress-api", "start"]
