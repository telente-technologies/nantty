FROM node:26.13.0-alpine
RUN corepack enable && corepack prepare pnpm@11.24.0 --activate
WORKDIR /repo
COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile \
    --filter @nantty/social... \
    --filter @nantty/media... \
    --filter @nantty/search... \
    --filter @nantty/notifications... \
    --filter @nantty/support... \
    && chown -R node:node /repo
USER node
CMD ["sh", "-c", "set -eu; for service in social media search notifications support; do (cd services/typescript/$service && set -a && . ./.env.example && set +a && pnpm exec prisma migrate deploy); done"]
