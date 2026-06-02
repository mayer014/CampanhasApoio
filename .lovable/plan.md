## Página temporária de diagnóstico Meta

Página oculta, acessível só para admin, para descobrir se o problema do `from.name` ausente em comentários do Facebook é **falta de permissão no App Review** ou **limitação oficial da Meta** (usuário com privacidade restrita / não autorizou o app).

Não aparece em menu nenhum, não é divulgada para clientes SaaS. Removemos depois que o diagnóstico estiver concluído.

### Onde fica

Rota nova: `src/routes/admin.diag-meta.tsx` (já dentro do layout `admin.tsx`, que tem gate de `role = admin`). URL: `/admin/diag-meta`. Sem link no menu — acesso só digitando.

### O que a página mostra

Seletor no topo: lista as conexões Meta ativas (de qualquer candidato) — admin escolhe qual diagnosticar.

Para a conexão selecionada, três blocos:

**1. Status do App Meta**
- App ID, modo (Development / Live), nome do App
- Lê via `GET /{app-id}?fields=id,name,namespace,app_domains` usando o token
- Avisa em vermelho se modo = Development (nesse caso só admins/testers do App veem `from.name`)

**2. Token & Escopos**
- Tipo de token (USER vs PAGE), validade, user_id/page_id
- Lista todos os escopos concedidos via `GET /debug_token`
- Marca em verde/vermelho a presença dos escopos críticos:
  - `pages_read_user_content` ← chave para `from.name` em comentários
  - `pages_manage_engagement`
  - `pages_show_list`, `pages_read_engagement`
  - `instagram_manage_comments`, `instagram_manage_insights`

**3. Amostra real de comentários**
- Puxa os 5 posts mais recentes da Página
- Para cada post, busca até 10 comentários
- Mostra tabela: `post_id | comment_id | autor_id | autor_nome | autor_username | mensagem (50 chars)`
- KPI no topo da tabela: `X de Y comentários (Z%) vêm com from.name preenchido`
- Botão "Re-hidratar individualmente" que tenta o `GET /{comment-id}` por comentário sem nome — útil pra confirmar que não é bug nosso, é a Meta omitindo mesmo

### Como interpretar o resultado (mostrado na própria página em um card de "Diagnóstico")

- **App em Development** → reaplicar para Live + App Review.
- **App em Live + escopo `pages_read_user_content` AUSENTE** → submeter App Review pra esse escopo. Esse é o cenário mais provável.
- **App em Live + escopo presente + ainda assim <50% com nome** → limitação da Meta (privacidade do usuário), não tem o que fazer. Plano B: mostrar "Usuário do Facebook" como fallback no inbox.
- **App em Live + escopo presente + >90% com nome** → já está funcionando, problema era cache antigo; rodar resync.

### Backend

Tudo em server functions novas, protegidas por `requireSupabaseAuth` + checagem manual de role admin (mesmo padrão do `admin.candidatos.index.tsx`):

`src/lib/meta-diag.functions.ts`:
- `listMetaConnectionsForDiag()` — lista todas as `social_connections` com `platform='meta'` e `status='connected'` (admin vê todas)
- `getMetaAppInfo({ connectionId })` — chama `/{app-id}` e `/debug_token`
- `getMetaDiagSample({ connectionId })` — puxa posts + comentários + hidrata individuais sem `from.name`, devolve estatística agregada

Helpers Graph reaproveitam `src/lib/meta-graph.server.ts` e `meta-comments.server.ts` que já existem.

### Segurança / privacidade

- Gate por role admin em todas as 3 server fns (não confiar só no layout)
- Não persiste nada novo no banco — tudo em memória, request-response
- Não loga conteúdo dos comentários
- Página tem banner no topo: "🔧 Ferramenta interna de diagnóstico — não divulgar"

### Como remover depois

Quando o diagnóstico fechar, apagar `src/routes/admin.diag-meta.tsx` e `src/lib/meta-diag.functions.ts`. Nenhum schema, nenhuma migration — remoção trivial.

### Fora de escopo

- Não mexe no inbox de comentários atual
- Não muda escopos do OAuth (`meta-oauth.ts`) — isso fica como ação seguinte se o diagnóstico apontar escopo faltando
- Não cria fallback "Usuário do Facebook" no inbox agora — decisão depende do resultado
