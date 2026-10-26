# syntax=docker/dockerfile:1
# build context: repository root
FROM node:24.22.1-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @nantty/gateway... && pnpm --filter @nantty/gateway build \
    && pnpm --filter @nantty/gateway deploy --prod --legacy /out

FROM node:24.22.1-alpine
ENV NODE_ENV=production
WORKDIR /app
# The runtime only runs node; drop the bundled package managers (their own deps carry CVEs).
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v* \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
COPY --from=build /out /app
USER node
EXPOSE 8080
CMD ["node", "dist/server.js"]
