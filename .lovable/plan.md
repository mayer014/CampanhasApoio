## Plano B — Painel da própria conta Meta via Graph API oficial

Objetivo: transformar os 3 cards "Em breve" da página `/painel/redes-sociais` em features funcionais usando o token Meta que já está salvo em `social_connections`. Tudo no stack atual (TanStack server fns + Supabase + Lovable AI Gateway). Sem crawler, sem VPS extra.

Entregue em 3 fases independentes, cada uma utilizável sozinha.

---

### Fase 1 — Métricas (Insights)

Nova tab/seção "Métricas" abrindo por padrão quando a conta está conectada.

**Instagram Business** (via `/{ig-user-id}/insights`):
- Seguidores totais + variação 7/30 dias (`follower_count`)
- Alcance e impressões agregados (`reach`, `impressions`) — gráfico de linha últimos 30 dias
- Engajamento total (`engagement`, `profile_views`, `website_clicks`)
- Top 5 posts recentes por engajamento — thumb + likes + comments + reach

**Facebook Page** (via `/{page-id}/insights`):
- Fãs da página + variação
- Alcance de publicações
- Engajamento total

**UX**: cards KPI no topo (número + delta colorido), gráfico Recharts de série temporal, lista de top posts. Filtro de período (7/30/90 dias).

**Backend**:
- `getMetaInsights` serverFn (`requireSupabaseAuth`) que lê o token do usuário e bate na Graph API v23.0
- Cache em tabela nova `social_insights_cache` (TTL 1h) para evitar bater na Meta a cada refresh
- Tratamento de token expirado → marca `status='expired'` e UI pede reconectar

---

### Fase 2 — Central de Comentários

Nova rota `/painel/redes-sociais/comentarios` com inbox unificado IG + FB.

**Funcionalidades**:
- Lista paginada de comentários recentes (IG: `/{ig-media-id}/comments`, FB: `/{post-id}/comments`)
- Filtros: plataforma, post, status (pendente/respondido/oculto), sentimento (após Fase 3)
- Ações por comentário: responder inline, ocultar, marcar como tratado, abrir post original
- Resposta envia via Graph API (`POST /{comment-id}/replies` no IG, `POST /{comment-id}/comments` no FB) e grava localmente

**Backend**:
- Tabelas novas:
  - `social_posts_cache` — id, connection_id, platform, external_id, caption, thumb, posted_at, metrics jsonb
  - `social_comments` — id, connection_id, platform, post_external_id, comment_external_id, author_name, text, posted_at, status enum(`pending`,`replied`,`hidden`,`handled`), parent_comment_id, raw jsonb
- ServerFns:
  - `syncMetaComments` — busca comentários novos dos últimos N posts e faz upsert
  - `listSocialComments` — lê do banco com filtros
  - `replySocialComment` — chama Graph e grava resposta
  - `updateCommentStatus` — muda status local
- Cron endpoint `/api/public/social/comments-sync-tick` (HMAC) chamado a cada 10min para puxar novos comentários de todas as conexões ativas

---

### Fase 3 — Sentimento com IA

Coluna de sentimento no inbox + painel de resumo.

**Pipeline (custo baixo)**:
1. Comentários novos entram com `sentiment = NULL`
2. Job em batch processa em lotes de 20 comentários por chamada → Lovable AI Gateway com `google/gemini-2.5-flash-lite` retornando JSON estruturado: `{ sentiment: positive|neutral|negative, emotion: string, topics: string[] }`
3. Grava em `social_comments` (colunas `sentiment`, `emotion`, `topics text[]`, `ai_processed_at`)

**UX**:
- Badge colorido no comentário (verde/amarelo/vermelho)
- Filtro por sentimento e emoção no inbox
- Card de resumo no topo da Central: % positivo/neutro/negativo dos últimos 7 dias, top 5 tópicos recorrentes, gráfico de evolução
- Botão "Resumo executivo" → chama Gemini com amostra clusterizada para gerar parágrafo curto sobre a percepção pública

**Backend**:
- `analyzeSocialComments` serverFn (chamada pelo cron tick logo após o sync)
- `getSentimentSummary` serverFn para o card de resumo

---

### Pré-requisitos

- Confirmar que os escopos do OAuth atual já incluem `instagram_manage_insights` e `instagram_manage_comments`. Se não, ajustar `META_SCOPES` em `src/lib/meta-oauth.ts` — exigirá reconexão por usuário.
- Segredo `SOCIAL_HMAC_SECRET` já existe → reaproveitar para o cron tick.
- Configurar pg_cron (ou cron externo do VPS) chamando `https://project--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app/api/public/social/comments-sync-tick` a cada 10 min.

---

### Detalhes técnicos

```
src/lib/
├── meta-graph.server.ts          (cliente Graph v23 + retry/refresh)
├── meta-insights.functions.ts    (Fase 1)
├── meta-comments.functions.ts    (Fase 2)
└── social-ai.functions.ts        (Fase 3)

src/routes/
├── painel.redes-sociais.tsx              (atualiza cards → tabs reais)
├── painel.redes-sociais.metricas.tsx     (Fase 1)
└── painel.redes-sociais.comentarios.tsx  (Fase 2 + 3)

src/routes/api/public/
└── social.comments-sync-tick.ts  (cron HMAC)
```

Tabelas novas: `social_insights_cache`, `social_posts_cache`, `social_comments` — todas com RLS `user_id = auth.uid()` via join em `social_connections`.

---

### Ordem de execução proposta

1. **Sprint 1** — Fase 1 completa (métricas). Entrega visível rápida, valida que o token funciona pra Graph API.
2. **Sprint 2** — Fase 2 (comentários: sync + listar + responder). Sem IA ainda.
3. **Sprint 3** — Fase 3 (sentimento + resumo IA).

Posso começar pela Fase 1 assim que aprovar.