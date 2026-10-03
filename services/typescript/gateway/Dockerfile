# syntax=docker/dockerfile:1
# build context: repository root
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @zudomart/gateway... && pnpm --filter @zudomart/gateway build \
    && pnpm --filter @zudomart/gateway deploy --prod --legacy /out

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out /app
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
