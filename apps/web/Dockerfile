# ─────────────────────────────────────────────────────────────────────────────
# Build context: monorepo root  (docker build -f apps/web/Dockerfile .)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /repo

# Copy workspace manifests — layer cache optimisation
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json    ./
COPY apps/web/package.json                               apps/web/
COPY packages/shared/package.json                        packages/shared/

RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/   packages/shared/
COPY apps/web/          apps/web/

# Build shared library (transpilePackages bundles it, but tsc types are needed)
RUN pnpm --filter @enterprise-openclaw/shared build

# Build Next.js (output: standalone is set in next.config.ts)
# NEXT_TELEMETRY_DISABLED suppresses the data-collection prompt
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @enterprise-openclaw/web build


# ── Stage 2: runner ───────────────────────────────────────────────────────────
# Use the same base as the builder so native modules match.
# node:22-alpine is ~60 MB — well below the full Debian image.
FROM node:22-alpine AS runner

RUN apk add --no-cache dumb-init

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js auto-detects the pnpm workspace and mirrors the monorepo layout
# inside .next/standalone/:
#   .next/standalone/
#     apps/web/
#       server.js         ← entry point
#       node_modules/     ← app-level traced deps
#     node_modules/       ← hoisted traced deps

COPY --from=builder /repo/apps/web/.next/standalone/        ./
COPY --from=builder /repo/apps/web/.next/static/            ./apps/web/.next/static/

# public/ is empty in this project; keep the COPY so it works when files are added
COPY --from=builder /repo/apps/web/public/                  ./apps/web/public/

# Next.js standalone listens on $PORT (default 3000); $HOSTNAME controls
# the bind address — must be 0.0.0.0 inside a container.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "apps/web/server.js"]
