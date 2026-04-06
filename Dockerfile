# ============================================================
# Fluxo — Dockerfile (multi-stage)
# ============================================================
# Stage 1 (deps)    — install pnpm + all dependencies
# Stage 2 (builder) — build Next.js and Fastify
# Stage 3 (runner)  — minimal production image
# ============================================================

# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm@latest --silent

# Copy workspace manifests first for layer caching
COPY pnpm-workspace.yaml package.json turbo.json ./

# Copy each package's manifest (preserving directory structure)
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json         apps/web/
COPY apps/server/package.json      apps/server/

# Install all dependencies (including devDeps needed for build)
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm + turbo
RUN npm install -g pnpm@latest turbo --silent

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules          ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules

# Copy all source files
COPY . .

# Build all apps via Turborepo
RUN pnpm turbo build

# ─── Stage 3: Runner ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# ── Next.js standalone output ────────────────────────────────────────────────
# next.config must have output: 'standalone'
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static      ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public            ./apps/web/public

# ── Fastify API server ───────────────────────────────────────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/apps/server/dist           ./apps/server/dist
COPY --from=builder --chown=nextjs:nodejs /app/apps/server/node_modules   ./apps/server/node_modules

# ── Shared packages ──────────────────────────────────────────────────────────
COPY --from=builder --chown=nextjs:nodejs /app/packages ./packages

# ── Entrypoint ───────────────────────────────────────────────────────────────
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Create data directory for SQLite
RUN mkdir -p /data && chown nextjs:nodejs /data

USER nextjs

EXPOSE 8080 8090

ENTRYPOINT ["/docker-entrypoint.sh"]
