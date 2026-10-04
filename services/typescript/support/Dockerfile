# syntax=docker/dockerfile:1
# build context: repository root
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @zudomart/support... \
    && pnpm --filter @zudomart/support exec prisma generate && pnpm --filter @zudomart/support deploy --prod --legacy /out \
    && cp -r services/typescript/support/prisma services/typescript/support/prisma.config.ts services/typescript/support/content /out/ \
    && cp -r services/typescript/support/src/generated /out/src/generated

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out /app
USER node
EXPOSE 8111
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node --import tsx src/server.ts"]
