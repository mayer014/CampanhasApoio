# syntax=docker/dockerfile:1.7

# ---------- Stage 1: build ----------
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates unzip \
  && curl -fsSL https://bun.sh/install | bash \
  && ln -s /root/.bun/bin/bun /usr/local/bin/bun \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY package.json bun.lockb* bunfig.toml* ./
RUN bun install --frozen-lockfile || bun install

COPY . .

# Vite inlines VITE_* at build time. Pass via --build-arg in Easypanel.
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
ENV CLOUDFLARE_INCLUDE_PROCESS_ENV=true

# The build emits a self-contained Worker bundle in dist/server (with its own
# wrangler.json) and static assets in dist/client. We only need those + wrangler.
COPY --from=builder /app/dist ./dist

# Install only wrangler at runtime (much smaller than copying all node_modules)
RUN npm install -g wrangler@4

EXPOSE 3000

WORKDIR /app/dist/server

# Serve the built Worker locally on 0.0.0.0:3000 using wrangler's local runtime
# (workerd). Works on any Linux x64 host without a Cloudflare account.
CMD ["wrangler", "dev", "--ip", "0.0.0.0", "--port", "3000", "--local", "--no-show-interactive-dev-session"]
