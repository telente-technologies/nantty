# syntax=docker/dockerfile:1
# build context: repository root
FROM node:24.22.1-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @nantty/social... && pnpm --filter @nantty/social build \
    && pnpm --filter @nantty/social deploy --prod --legacy /out \
    && cp -r services/typescript/social/prisma services/typescript/social/prisma.config.ts /out/ \
    && cp -r services/typescript/social/dist /out/dist

FROM node:24.22.1-alpine
ENV NODE_ENV=production
WORKDIR /app
# The runtime only runs node; drop the bundled package managers (their own deps carry CVEs).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build /out /app
USER node
EXPOSE 8105
CMD ["node", "--import", "tsx", "dist/server.js"]
