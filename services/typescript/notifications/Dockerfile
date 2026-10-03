# syntax=docker/dockerfile:1
# build context: repository root
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @zudomart/notifications... \
    && pnpm --filter @zudomart/notifications exec prisma generate \
    && pnpm --filter @zudomart/notifications deploy --prod --legacy /out \
    && cp -r services/typescript/notifications/src/generated /out/src/generated

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out /app
USER node
EXPOSE 8104
CMD ["node", "--import", "tsx", "src/server.ts"]
