# syntax=docker/dockerfile:1
# build context: repository root
FROM --platform=$BUILDPLATFORM node:26.13.0-alpine AS build
RUN npm install --global pnpm@11.24.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @nantty/media... \
    && pnpm --filter @nantty/media build

FROM node:26.13.0-alpine AS package
RUN npm install --global pnpm@11.24.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @nantty/media...
COPY --from=build /repo/services/typescript/media/src/generated /repo/services/typescript/media/src/generated
COPY --from=build /repo/services/typescript/media/dist /repo/services/typescript/media/dist
RUN pnpm --filter @nantty/media deploy --prod --legacy /out \
    && cp -r services/typescript/media/prisma services/typescript/media/prisma.config.ts /out/ \
    && cp -r services/typescript/media/dist /out/dist

FROM node:26.13.0-alpine
ENV NODE_ENV=production
WORKDIR /app
# The runtime only runs node; drop the bundled package managers (their own deps carry CVEs).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
RUN apk add --no-cache ffmpeg libheif-tools fontconfig font-dejavu
ENV FFMPEG_MODE=required
COPY --from=package /out /app
USER node
EXPOSE 8108
CMD ["node", "--import", "tsx", "dist/server.js"]
