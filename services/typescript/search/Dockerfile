# syntax=docker/dockerfile:1
# build context: repository root
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @zudomart/search... \
    && pnpm --filter @zudomart/search exec prisma generate && pnpm --filter @zudomart/search deploy --prod --legacy /out \
    && cp -r services/typescript/search/prisma services/typescript/search/prisma.config.ts /out/ \
    && cp -r services/typescript/search/src/generated /out/src/generated

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out /app
USER node
EXPOSE 8109
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node --import tsx src/server.ts"]
