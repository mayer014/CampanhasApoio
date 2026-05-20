# social-crawler

Worker Node.js standalone que rastreia perfis públicos do Instagram via Playwright
e envia dados para o backend Lovable (TanStack Start) através de endpoints assinados
com HMAC-SHA256.

> Este worker NÃO roda no Cloudflare Workers — ele precisa de um host capaz de
> rodar Chromium (VPS, Fly.io machine, Railway, Render Background Worker, etc.).

## Variáveis de ambiente

```
API_BASE_URL=https://project--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app
SOCIAL_HMAC_SECRET=<mesmo valor configurado no app>
WORKER_ID=worker-1
POLL_INTERVAL_MS=15000
MAX_POSTS_PER_RUN=12
HEADLESS=true
# opcional
PROXY_URL=http://user:pass@proxy.example.com:8080
```

## Executar local

```
npm install
npx playwright install --with-deps chromium
npm start
```

## Docker

```
docker build -t social-crawler .
docker run --rm \
  -e API_BASE_URL=... \
  -e SOCIAL_HMAC_SECRET=... \
  -e WORKER_ID=worker-1 \
  social-crawler
```

## Arquitetura

```
queue.ts     → busca próximo job em /api/public/social/next-job
crawler.ts   → abre o perfil, rola feed (incremental: para no 1º external_id conhecido)
antiBlock.ts → user-agent rotation, jitter, viewport randômico, throttling
report.ts    → POST /api/public/social/ingest com HMAC
browser.ts   → singleton de Chromium (1 contexto por worker)
index.ts     → loop principal
```

## Coleta incremental

O backend devolve, junto do job, os últimos `external_id` conhecidos
(via futuras iterações). Por enquanto, o crawler simplesmente envia
TODOS os posts visíveis no primeiro scroll (≤ MAX_POSTS_PER_RUN) e o
backend dedupa por `(profile_id, external_id)`.

Para evitar carga desnecessária, NÃO role além do limite — Instagram
mostra ~12 posts por viewport, suficiente para coleta incremental
em perfis com cadência normal.
