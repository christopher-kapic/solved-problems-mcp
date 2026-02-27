# ---- Base ----
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.20.0 --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/api/package.json packages/api/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/config/package.json packages/config/package.json
RUN pnpm install --frozen-lockfile

# ---- Builder ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=deps /app/packages/auth/node_modules ./packages/auth/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/env/node_modules ./packages/env/node_modules
COPY . .

# Generate Prisma client
RUN pnpm --filter @solved-problems/db db:generate

# Build server
RUN pnpm --filter server build

# Build Next.js web app
RUN pnpm --filter web build

# ---- Runner ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Copy pnpm workspace files for db:push
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY packages/db/package.json packages/db/package.json
COPY packages/env/package.json packages/env/package.json
COPY packages/config/package.json packages/config/package.json

# Copy package.json files needed for pnpm workspace resolution
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json

# Install production deps only
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/env/node_modules ./packages/env/node_modules
# Copy Prisma schema and generated client (needed for db:push and runtime)
COPY packages/db ./packages/db
COPY packages/env ./packages/env
COPY packages/config ./packages/config

# Copy built server
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

# Copy Next.js standalone output (preserving monorepo paths for module resolution)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

# Set WORKDIR so dir: "../../web" resolves from apps/server/dist/ to apps/web/
WORKDIR /app/apps/server

EXPOSE 3000

CMD ["sh", "-c", "[ \"$APPLY_SCHEMA\" = \"true\" ] && cd /app && pnpm --filter @solved-problems/db db:push; cd /app/apps/server && node dist/index.mjs"]
