# syntax=docker/dockerfile:1
# Build from the repository root (the pnpm workspace):
#   docker build -f apps/api/Dockerfile .
# The committed pnpm-lock.yaml is required: installs are frozen so the image
# contains exactly the reviewed dependency versions.

FROM node:24-alpine AS base
WORKDIR /repo
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/shared-types/package.json packages/shared-types/

FROM base AS build
RUN pnpm install --frozen-lockfile --filter @zudomart/api...
COPY packages packages
COPY apps/api/tsconfig.json apps/api/prisma.config.ts apps/api/
COPY apps/api/prisma apps/api/prisma
COPY apps/api/src apps/api/src
RUN pnpm --filter @zudomart/api run build

FROM base AS prod-deps
RUN pnpm install --frozen-lockfile --prod --filter @zudomart/api...

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /repo
# Files stay owned by root: the app user can read them but not rewrite its own code.
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY apps/api/package.json ./apps/api/
WORKDIR /repo/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/server.js"]
