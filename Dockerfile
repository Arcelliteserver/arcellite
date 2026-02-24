# ─────────────────────────────────────────────────────────────────────────────
#  Arcellite — Multi-stage Production Dockerfile
#
#  Stage 1 (deps):   install ALL npm deps (including dev)
#  Stage 2 (build):  compile TypeScript server + build React/Vite frontend
#  Stage 3 (runner): minimal production image — no build tools, no dev deps
#
#  Build:  docker build -t arcellite .
#  Run:    docker run -p 3999:3999 --env-file .env arcellite
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ──────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app

# Install native build tools needed for bcrypt + sharp
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    libc6-compat

# Copy manifests first for layer caching
COPY package.json package-lock.json ./

# Install all deps (including devDependencies needed for the build step)
RUN npm ci --ignore-scripts=false


# ── Stage 2: Build ─────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source
COPY . .

# 1. Compile TypeScript server → server/dist/
RUN npm run build:server

# 2. Build React/Vite frontend → dist/
RUN npm run build


# ── Stage 3: Production runner ─────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Security: run as non-root user
RUN addgroup -g 1001 -S arcellite && \
    adduser  -u 1001 -S arcellite -G arcellite

# Install runtime-only system deps
RUN apk add --no-cache \
    curl \
    # udisks2 / lsblk not available in Alpine — USB mount is host-only feature
    util-linux

# Copy compiled server output
COPY --from=build --chown=arcellite:arcellite /app/server/dist ./server/dist

# Copy built frontend (served as static files by the Node server)
COPY --from=build --chown=arcellite:arcellite /app/dist ./dist

# Copy public assets (app icons, etc.)
COPY --from=build --chown=arcellite:arcellite /app/public ./public

# Copy package manifests then install PRODUCTION deps only
COPY --chown=arcellite:arcellite package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false && \
    npm cache clean --force

# Data directory — mounted as a named volume in production
RUN mkdir -p /data && chown arcellite:arcellite /data

USER arcellite

# Port the Node server listens on (must match PORT env + docker-compose.yml)
EXPOSE 3999

# Health check — Docker marks container unhealthy if this fails
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -sf http://localhost:3999/api/health || exit 1

# Start the compiled server
CMD ["node", "server/dist/index.js"]
