# syntax=docker/dockerfile:1
# build context: repository root
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @zudomart/social... && pnpm --filter @zudomart/social build \
    && pnpm --filter @zudomart/social deploy --prod --legacy /out \
    && cp -r services/typescript/social/prisma services/typescript/social/prisma.config.ts /out/ \
    && cp -r services/typescript/social/dist /out/dist

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out /app
USER node
EXPOSE 8105
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/server.js"]
