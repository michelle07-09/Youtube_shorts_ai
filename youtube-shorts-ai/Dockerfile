FROM node:20-alpine AS base

# ── Stage 1: Install dependencies ──────────────────────────────────────
FROM base AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ── Stage 2: Build the Next.js app ─────────────────────────────────────
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build Next.js standalone output
RUN npm run build

# ── Stage 3: Production runner ─────────────────────────────────────────
FROM base AS runner
WORKDIR /app

# Install system deps: ffmpeg for video assembly + curl for healthcheck
RUN apk add --no-cache ffmpeg curl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Create persistent directories (will be mounted as volumes on Railway)
RUN mkdir -p /app/data /app/output && chown -R nextjs:nodejs /app/data /app/output

# Default env vars for persistent storage paths
ENV DATA_DIR=/app/data
ENV OUTPUT_DIR=/app/output

# Port
ENV PORT=3000
EXPOSE 3000

USER nextjs

# Start the standalone Next.js server
CMD ["node", "server.js"]
