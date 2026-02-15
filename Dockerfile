# ───────────────────────────────────────────────────────────
# CloudNest (Arcellite) — Production Dockerfile
# Multi-stage build: install deps → build frontend → run
# ───────────────────────────────────────────────────────────

FROM node:20-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ udev udisks2 util-linux \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ── Stage 1: Install dependencies ──────────────────────────
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci --include=dev

# ── Stage 2: Production image ─────────────────────────────
FROM base AS runner

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code
COPY . .

# Create data directory
RUN mkdir -p /data/arcellite-data && \
    mkdir -p /data/arcellite-data/files && \
    mkdir -p /data/arcellite-data/photos && \
    mkdir -p /data/arcellite-data/videos && \
    mkdir -p /data/arcellite-data/music && \
    mkdir -p /data/arcellite-data/.security

# Environment defaults (overridden by docker-compose)
ENV NODE_ENV=production
ENV ARCELLITE_DATA=/data/arcellite-data
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "const http=require('http');const r=http.get('http://localhost:3000',res=>{process.exit(res.statusCode===200?0:1)});r.on('error',()=>process.exit(1))"

# Run via Vite (serves both frontend + all API routes via middleware)
CMD ["npx", "vite", "--host", "0.0.0.0", "--port", "3000"]
