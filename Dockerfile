# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build ----------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Install bun (project uses bunfig.toml / bun lockfile may exist)
RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip \
  && curl -fsSL https://bun.sh/install | bash \
  && ln -s /root/.bun/bin/bun /usr/local/bin/bun \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy manifests first for better layer caching
COPY package.json bun.lockb* bunfig.toml* ./

RUN bun install --frozen-lockfile || bun install

# Copy the rest of the source
COPY . .

# Build-time public env (Vite inlines VITE_* at build). Pass via --build-arg.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_PROJECT_ID=$VITE_SUPABASE_PROJECT_ID

RUN bun run build

# ---------- Stage 2: runtime ----------
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Copy build output and the wrangler config
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/wrangler.jsonc ./wrangler.jsonc

EXPOSE 3000

# Serve the built Worker locally on 0.0.0.0:3000 using wrangler (workerd runtime).
# This works on any Linux x64 host (Easypanel/VPS) without Cloudflare account.
CMD ["npx", "wrangler", "dev", "--ip", "0.0.0.0", "--port", "3000", "--local"]
