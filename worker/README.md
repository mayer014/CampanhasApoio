# social-crawler worker v2

Worker que processa jobs da tabela `social_jobs` no Supabase.

## Mudança principal vs. v1

**Antes:** worker → HTTP → `/api/public/social/*` (site publicado) → Supabase
**Agora:** worker → Supabase (direto, com `service_role`)

Não depende mais do site estar de pé. Não usa HMAC. Não precisa de `TARGET_URL`.

## Envs (EasyPanel)

| Var | Valor |
|---|---|
| `SUPABASE_URL` | `https://pfppmkqsdqawvykkgafe.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (Dashboard Supabase → Settings → API → service_role) |
| `WORKER_ID` | `worker-1` |
| `POLL_INTERVAL_MS` | (opcional) default `5000` |
| `HEARTBEAT_INTERVAL_MS` | (opcional) default `30000` |

## Como adaptar do worker antigo

Abra `index.js` e procure por `processJob`. Cole ali a lógica de scraping que
seu worker atual já faz (Instagram, etc). O resto (claim, complete, heartbeat,
log de erro) já está pronto.

Contrato:
- recebe `{ job, profile }`
- faz o trabalho
- se der erro, `throw` — o loop chama `complete_social_job(ok=false)` e loga
- se OK, o loop chama `complete_social_job(ok=true)` automaticamente

Para gravar posts coletados:
```js
await sb.from('social_posts').upsert({
  candidate_id: job.candidate_id,
  profile_id: profile.id,
  platform: profile.platform,
  external_id: '...',
  post_url: '...',
  caption: '...',
  likes: 0, comments: 0, views: 0,
  posted_at: '...',
}, { onConflict: 'profile_id,external_id' });
```

## Deploy no EasyPanel

1. Build context: `apps/worker` (no monorepo) ou raiz (se vier sozinho).
2. Dockerfile: o que está aqui.
3. Sem domínio (worker não escuta HTTP).
4. Healthcheck: pode deixar desligado (heartbeat fica na tabela `social_workers`).
