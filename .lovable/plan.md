
# Fase 1 — Social Intelligence Engine

Escopo estrito: somente coleta incremental de posts do Instagram público + alertas heurísticos. **Sem IA, sem comentários, sem embeddings.**

Boa parte da infra já existe no banco (tabelas `social_profiles`, `social_posts`, `social_jobs`, `social_workers`, `social_worker_logs`, `social_system_state` + funções `claim_next_social_job`, `complete_social_job`, `enqueue_due_social_profiles`, `social_dashboard_stats`) e o diretório `social-crawler/` já está esboçado. Foram deletados na conversa anterior: a UI `/painel/social`, os endpoints `/api/public/social/*` e o helper HMAC. Esta fase reconstrói o que falta de forma definitiva e adiciona apenas o que está faltando no schema.

---

## 1) Migração SQL (delta, não destrutiva)

Tudo via `supabase--migration`. O que muda em relação ao schema atual:

**a) Enum novo `social_profile_type`** com valores `own_profile | competitor | portal | influencer`.

**b) Coluna `profile_type` em `social_profiles`**
- `profile_type social_profile_type NOT NULL DEFAULT 'competitor'`
- Backfill: `UPDATE social_profiles SET profile_type = CASE WHEN is_own THEN 'own_profile' ELSE 'competitor' END`
- Mantém `is_own` por compatibilidade (deprecado, sincronizado por trigger simples).
- Unique `(candidate_id, platform, lower(username))` para evitar duplicatas.

**c) Tabela nova `social_post_snapshots`** (histórico de métricas por post)
- `id bigserial PK`, `post_id uuid FK → social_posts(id) ON DELETE CASCADE`
- `candidate_id uuid NOT NULL` (multi-tenant + RLS)
- `captured_at timestamptz NOT NULL DEFAULT now()`
- `likes int`, `comments int`, `views int`
- Index `(post_id, captured_at DESC)` e `(candidate_id, captured_at DESC)`
- RLS: admin tudo; owner SELECT por `candidate_id = auth.uid()`.

**d) Tabela nova `social_alerts`** (Fase 1 sem IA — somente heurística)
- `id uuid PK`, `candidate_id uuid NOT NULL`, `profile_id uuid`, `post_id uuid`
- `alert_type text` restrito a `viral_post | competitor_growth`
- `severity text` (`info|warn|critical`)
- `title text`, `message text`, `data jsonb`
- `created_at`, `acknowledged_at`, `acknowledged_by`
- RLS: admin tudo; owner SELECT/UPDATE por `candidate_id`.

**e) Função `record_social_snapshot(_post_id uuid)`** SECURITY DEFINER: insere snapshot e gera alertas `viral_post`/`competitor_growth` aplicando heurística pura:
- `viral_post`: likes do post crescem ≥ 3× a média móvel dos últimos 7 snapshots em < 6h.
- `competitor_growth`: perfil `competitor` ganha ≥ 10% de followers em 7 dias.
- Usa janela `WHERE` sobre os próprios snapshots, sem AI.

**f) Ajuste em `complete_social_job` / `ingest`**: chamar `record_social_snapshot` após cada upsert de post bem-sucedido.

Sem mexer em `auth`, `storage`, etc. Tudo `public.*`.

---

## 2) Endpoints `/api/public/social/*` (reconstrução)

Todos com HMAC-SHA256 (`x-social-signature: sha256=<hex>`) usando `SOCIAL_HMAC_SECRET` já existente. Reaproveitar helper `src/lib/social-hmac.server.ts`.

| Rota | Método | Função |
|---|---|---|
| `social.next-job` | POST | `claim_next_social_job` (já usa `FOR UPDATE SKIP LOCKED`) |
| `social.ingest` | POST | upsert de `social_profiles` (display_name/bio/followers/avatar) + upsert idempotente de `social_posts` por `(profile_id, external_id)` + `record_social_snapshot` |
| `social.complete` | POST | `complete_social_job` (status transitions + retry exponencial já existente) |
| `social.heartbeat` | POST | `social_worker_heartbeat` |
| `social.log` | POST | insere `social_worker_logs` |
| `social.cron` | POST | autenticado por `apikey` → `enqueue_due_social_profiles` |
| `social.health` | GET | probes select + rpc |

Validação Zod estrita em todo body. Erros retornam 400/401 com JSON. Sem PII em respostas.

---

## 3) UI `/painel/social` (reconstrução)

Rota `src/routes/painel.social.tsx` no padrão visual do `painel.whatsapp.tsx`. **Reinclui o item de navegação `Inteligência Social` em `src/routes/painel.tsx`** (foi removido na conversa anterior).

Single page com tabs:

**Tab "Perfis Monitorados"**
- Tabela: avatar, `@username`, plataforma, `profile_type` (badge colorida), `is_active` (Switch), `last_checked_at` (relativo), `consecutive_errors`, último erro truncado.
- Botão "Adicionar perfil" abre Dialog: `username` (regex), `profile_type` (Select com own_profile/competitor/portal/influencer), `check_interval_minutes` (default 360).
- Ações por linha: ativar/desativar, ajustar intervalo, excluir.

**Tab "Posts coletados"**
- Grid de cards com thumbnail, legenda truncada, likes/comments/views, data e link externo. Filtro por perfil.

**Tab "Operação"**
- Cards: workers online, jobs por status (pending/running/done/failed), posts hoje, estado do circuit breaker.
- Lista de erros recentes de `social_worker_logs` (nível warn+).

Server fns em `src/lib/social.functions.ts` (todas com `requireSupabaseAuth`):
`listSocialProfiles`, `addSocialProfile`, `updateSocialProfile`, `deleteSocialProfile`, `listSocialPosts`, `getSocialDashboard`. Adicionar `profile_type` no schema Zod do `addSocialProfile`.

Data fetching via `useQuery` + `useServerFn` (não em loader, para evitar 401 em prerender).

---

## 4) Crawler `social-crawler/` (finalização do esboço existente)

O esqueleto já existe. Garantir Fase 1:

- `browser.ts`: singleton Playwright `chromium` headless, `userAgent` rotacionado, `viewport` 390x844 (mobile-like).
- `antiBlock.ts`: `jitter(min,max)`, backoff exponencial, randomização de scroll, pausa longa a cada N requisições.
- `queue.ts`: chama `next-job` / `ingest` / `complete` / `heartbeat` / `log` com HMAC; `classifyError(msg)` → `login_wall|rate_limit|captcha|network|parse|other`.
- `crawler.ts` (Fase 1): visita `https://www.instagram.com/{username}/`, extrai do JSON embutido / DOM:
  - perfil: `display_name`, `avatar_url`, `bio`, `followers_count`
  - até N posts recentes (12): `shortcode` (= `external_id`), `caption`, `hashtags` (parse da legenda), `posted_at`, `likes`, `comments`, `views` (reels), `thumbnail_url`, `media_urls`, `post_type` (feed/reel/carousel inferido)
  - **incremental**: para ao encontrar `external_id` já presente em `social_posts` (a UI já dá o sinal via resposta de `/ingest` retornando `inserted=0 && updated=1`; o crawler para localmente quando bate 2 shortcodes consecutivos já vistos no batch).
- `index.ts`: loop com `tick`, heartbeat 30s, respeito ao circuit breaker, backoff em `idle`.
- `Dockerfile`: `mcr.microsoft.com/playwright:v1.47.0-jammy`, `bun install`, `bun run start`.
- README: variáveis `API_BASE_URL`, `SOCIAL_HMAC_SECRET`, `WORKER_ID`, `POLL_INTERVAL_MS`, `IDLE_BACKOFF_MS`.

**Sem comentários, sem login, sem detalhes de post.** Apenas a página do perfil.

---

## 5) Alertas heurísticos (sem IA)

Disparados dentro de `record_social_snapshot` (SQL puro):

- `viral_post` — quando o post mais recente de um `own_profile` ou `competitor` cresce ≥ 3× a média dos snapshots anteriores em < 6h, severity `warn`.
- `competitor_growth` — perfil `competitor` com `followers_count` crescendo ≥ 10% em janela de 7 dias, severity `info`.

Mostrados num card simples na tab "Operação" (não há tela de alertas dedicada nesta fase).

---

## 6) Operação / cron

Após approval da migração, o usuário roda no SQL Editor (uma vez):

```sql
select cron.schedule(
  'social-enqueue', '*/5 * * * *',
  $$ select net.http_post(
       url:='https://<host>/api/public/social/cron',
       headers:='{"apikey":"<ANON_KEY>"}'::jsonb,
       body:='{}'::jsonb) $$);
```

O worker roda em VPS/EasyPanel apontando para `https://<host>/api/public/social/*` com `SOCIAL_HMAC_SECRET`.

---

## 7) Fora de escopo (explícito)

Comentários, sentimentos, embeddings, clustering, Gemini/OpenAI, dashboard avançado, comparativos, narrativa, mapa territorial. Tudo isso fica para fases seguintes — o schema já foi desenhado para acomodar sem migração disruptiva.

---

## Detalhes técnicos

- **Server fns**: `createServerFn` + `requireSupabaseAuth`; chamadas com `useServerFn` em queries (nunca em loader de rota pública).
- **Endpoints públicos**: `createFileRoute('/api/public/social/...')` com Zod + HMAC `timingSafeEqual`.
- **RLS**: já existente para tabelas atuais; replicar para `social_post_snapshots` e `social_alerts` (admin all + owner select por `candidate_id`).
- **Idempotência da ingestão**: chave única `(profile_id, external_id)` em `social_posts` (adicionar se não existir).
- **Backoff**: já implementado em `complete_social_job` (exponencial até 240min). Circuit breaker via `social_system_state` continua válido.
- **Sem segredos no banco**: `SOCIAL_HMAC_SECRET` permanece em env.

```text
fluxo de uma rodada
┌────────────┐   cron     ┌──────────────────────────┐
│ pg_cron *5 │ ─────────▶ │ enqueue_due_social_jobs  │
└────────────┘            └──────────────────────────┘
                                       │
                          ┌────────────┴───────────┐
                          ▼                        ▼
                  ┌──────────────┐         ┌──────────────┐
                  │ next-job RPC │◀──HMAC──│ worker (VPS) │
                  └──────────────┘         │  Playwright  │
                          │                └──────────────┘
                          ▼                        │
                  ┌──────────────┐         ingest  │
                  │ social_jobs  │◀────────────────┘
                  │  running →   │
                  │   done       │  → record_social_snapshot
                  └──────────────┘         → alerts (heurística)
```

---

## Entregáveis nesta fase

1. Migração SQL: enum `social_profile_type`, coluna `profile_type`, tabelas `social_post_snapshots` e `social_alerts`, função `record_social_snapshot`, unique constraints.
2. `src/lib/social-hmac.server.ts` + `src/lib/social.functions.ts`.
3. 7 rotas `src/routes/api/public/social.*.ts`.
4. `src/routes/painel.social.tsx` + reinclusão do item no menu de `src/routes/painel.tsx`.
5. `social-crawler/` finalizado (crawler de perfil, sem comentários) + README de deploy.

Aprove para eu iniciar pela migração (passo 1) e seguir em sequência.
