# syntax=docker/dockerfile:1
# build context: repository root
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @zudomart/media... && pnpm --filter @zudomart/media build \
    && pnpm --filter @zudomart/media deploy --prod --legacy /out \
    && cp -r services/typescript/media/prisma services/typescript/media/prisma.config.ts /out/ \
    && cp -r services/typescript/media/dist /out/dist

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache ffmpeg libheif-tools fontconfig font-dejavu
ENV FFMPEG_MODE=required
COPY --from=build /out /app
USER node
EXPOSE 8108
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && node dist/server.js"]
