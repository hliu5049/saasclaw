# ─────────────────────────────────────────────────────────────────────────────
# Build context: monorepo root  (docker build -f apps/backend/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

# Copy workspace manifests first — maximises layer cache hits on re-builds
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json          ./
COPY apps/backend/package.json                                  apps/backend/
COPY packages/shared/package.json                               packages/shared/

# Install ALL deps (devDeps needed for tsc)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/   packages/shared/
COPY apps/backend/      apps/backend/

# 1. Build shared library
RUN pnpm --filter @enterprise-openclaw/shared build

# 2. Generate Prisma client (writes into node_modules/@prisma/client)
RUN pnpm --filter @enterprise-openclaw/backend exec prisma generate

# 3. Compile TypeScript → dist/
RUN pnpm --filter @enterprise-openclaw/backend build

# 4. Create a self-contained production deployment folder:
#    - resolves workspace:* → copies packages into node_modules
#    - excludes devDependencies
#    - prisma is now a prod dep, so it's included
RUN pnpm deploy --filter @enterprise-openclaw/backend --prod /deploy

# 5. Re-run prisma generate inside the pruned folder so the native query
#    engine binary is correct for the final alpine image
RUN cd /deploy && node_modules/.bin/prisma generate


# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

# dumb-init: PID-1 signal forwarding + zombie reaping
RUN apk add --no-cache dumb-init

WORKDIR /app

# Production node_modules (workspace deps resolved, no devDeps)
COPY --from=builder /deploy/node_modules        ./node_modules

# Compiled JavaScript
COPY --from=builder /repo/apps/backend/dist     ./dist

# Schema + migrations — needed by "prisma migrate deploy" at startup
COPY --from=builder /repo/apps/backend/prisma   ./prisma

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

ENTRYPOINT ["dumb-init", "--"]

# migrate deploy is idempotent; safe to run on every container start.
# It applies any pending migrations before the server opens the port.
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/server.js"]
