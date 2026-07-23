## Objetivo
Substituir o OAuth Meta próprio (Facebook Pages + Instagram) por SocialAPI.ai como intermediário único. Cada cliente do SaaS continua vendo apenas suas próprias conexões; a chave SocialAPI é única, do servidor.

## Pré-requisito bloqueante
A doc da SocialAPI.ai não está acessível ao assistente. Antes de codar preciso de 4 pontos (cole no chat um trecho/print):

1. **Iniciar OAuth** — URL, método, headers, como passar `platform` (facebook/instagram) e `redirect_uri` do nosso callback. Como o `state` é gerado/retornado.
2. **Callback** — quais query params voltam (`code`+`state`? outro nome?), se já vem `access_token` ou se precisa trocar.
3. **Trocar código por conta** — endpoint, formato da resposta (account_id, nome, foto, token, expiração, page_id, instagram_business_id).
4. **Desconectar/revogar** — endpoint e payload.
5. **Endpoints equivalentes ao Graph** que vamos usar: listar posts de página, listar comentários de um post, responder comentário, insights de página e de IG business. Formato de auth (header vs query, account_id no path?).

Sem isso, o cliente HTTP fica com TODOs. Posso começar pelo esqueleto se você preferir — indica no chat.

## Escopo da mudança

### Remover (depois da validação)
- `src/lib/meta-oauth.ts`
- `src/routes/api/public/meta.oauth.ts`
- `src/routes/auth.meta.callback.tsx`
- OAuth de `src/lib/meta-connect.functions.ts` (a função `exchangeCodeAndSave` e `connectMetaAccount`)
- Secrets `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI` (apenas após validar em produção)

### Manter
- Tabela `social_connections` (schema atual serve: `platform`, `access_token`, `page_id`, `instagram_business_id`, `metadata`) e suas RLS por `auth.uid()`
- `social_insights_cache`, `social_militants`, `social_comments`
- Telas do painel (`painel.redes-sociais.tsx`, `painel.redes-sociais_.comentarios.tsx`) — mudança só nos handlers dos botões

### Novos arquivos
- `src/lib/socialapi.server.ts` — cliente HTTP server-only, lê `SOCIALAPI_API_KEY` de `process.env` dentro dos handlers.
- `src/lib/socialapi-connect.functions.ts` — 3 server functions com `requireSupabaseAuth`:
  - `startSocialConnect({ platform })` → gera `state`, insere em `socialapi_oauth_states`, chama SocialAPI para obter `auth_url`, retorna `{ auth_url }`.
  - `completeSocialConnect({ code, state })` → valida state (pertence ao `auth.uid()`, < 10 min), troca `code` por dados da conta na SocialAPI, faz `upsert` em `social_connections` (`platform`, tokens, `page_id`, `instagram_business_id`, `metadata.socialapi_account_id`), apaga o state.
  - `disconnectSocial({ connection_id })` → revoga na SocialAPI, deleta linha.
- `src/routes/auth.socialapi.callback.tsx` — rota pública que lê `code`+`state` da URL, chama `completeSocialConnect`, mostra estado e redireciona para `/painel/redes-sociais`.

### Nova migração SQL
Tabela `socialapi_oauth_states`:
- Colunas: `state` (text pk), `user_id` (uuid), `platform` (text), `created_at` (timestamptz default now())
- GRANTs para `authenticated` e `service_role`
- RLS habilitado; policies só permitem que o dono leia/apague sua própria linha (insert também via server function autenticada)
- Necessária porque a SocialAPI faz round-trip fora da sessão do app

### Refactor sem mudar assinatura pública
- `src/lib/meta-graph.server.ts` → renomear conceitualmente para "provider da rede social" ou manter e reimplementar internamente batendo na SocialAPI.
- `src/lib/meta-comments.functions.ts` / `meta-comments.server.ts` — listar/responder comentários passa a chamar SocialAPI usando `access_token`/`account_id` de `social_connections`.
- `src/lib/meta-insights.functions.ts` — mesma coisa para insights de página e IG business.
- `src/lib/meta-diag.functions.ts` — reescrever para diagnosticar via SocialAPI (status da conta, escopos concedidos, amostra de comentários).

Assinaturas e shapes de retorno dessas server functions ficam idênticos → o front (`painel.redes-sociais.tsx`, `painel.redes-sociais_.comentarios.tsx`, `admin.diag-meta.tsx`) não precisa de alterações estruturais, só o botão "Conectar" muda para chamar `startSocialConnect` e `window.location.assign(auth_url)`.

### Secrets
- **Novo:** `SOCIALAPI_API_KEY` (pedido via `add_secret` no build).
- **Mantidos:** `SOCIAL_HMAC_SECRET`, `WHATSHUB_MASTER_TOKEN` (não relacionados a login social).
- **Descontinuar após validação:** `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`.

## Multi-tenant
- `social_connections.user_id = auth.uid()` continua sendo a barreira (RLS já existe).
- `metadata.socialapi_account_id` guarda o handle para chamadas subsequentes.
- Todas as chamadas à SocialAPI ficam em server functions autenticadas — `SOCIALAPI_API_KEY` nunca vai ao browser.
- `socialapi_oauth_states` protege o CSRF: `state` só é resolvido pelo `user_id` que iniciou o fluxo.

## Ordem de execução (após você mandar a doc / autorizar TODOs)
1. Migração `socialapi_oauth_states` + `add_secret SOCIALAPI_API_KEY`.
2. `socialapi.server.ts` (cliente HTTP).
3. `socialapi-connect.functions.ts` + rota `auth.socialapi.callback.tsx`.
4. Trocar botões em `painel.redes-sociais.tsx`.
5. Reimplementar `meta-comments.*`, `meta-insights.*`, `meta-diag.functions.ts` sobre a SocialAPI, mantendo assinaturas.
6. Testar fluxo end-to-end no preview, depois em produção.
7. Remover arquivos/secrets Meta legados.

## Resposta esperada de você antes de eu implementar
Cole os trechos da doc da SocialAPI cobrindo os 5 pontos acima, **ou** diga "faz esqueleto com TODOs" e eu entrego steps 1–4 com stubs marcados.
