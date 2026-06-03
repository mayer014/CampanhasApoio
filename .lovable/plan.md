## Diagnóstico

A mensagem `internal error; reference = g78nupdkn1j2ufhrecu7pd8n` **não vem do seu código**. É a página de erro padrão do **workerd** (runtime do `wrangler dev --local` que roda dentro do seu container Docker no Easypanel). Ela aparece sempre que uma exceção **escapa** da função `fetch` do worker — o workerd engole o stacktrace e devolve esse HTML genérico, sem nada nos logs.

Por isso hoje você vê esse erro mas **não consegue saber qual é**.

Causas possíveis (em ordem de probabilidade) para o `createInstance` quebrar no Easypanel mas funcionar no preview da Lovable:

1. **Variável de ambiente faltando no runtime do Easypanel** — o `supabaseAdmin` (`client.server.ts` linha 34-38) faz `throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY...")`. Se essa variável não está setada no container, qualquer rota que carregue esse módulo morre. Mesma coisa vale para `SUPABASE_URL` se a fallback constant não bater.
2. **Edge Function `whatsapp-bridge-proxy` indisponível ou sem o secret `WHATSHUB_MASTER_TOKEN`** no Supabase — o `bridge()` faz `fetch` para ela e, se der erro de rede/TLS dentro do workerd local, lança exceção não tratada.
3. **Resposta não-JSON do bridge** virando `JSON.parse` que dispara antes do `try/catch`.

Sem o wrapper de SSR, qualquer uma dessas três falha cai na tela `internal error; reference = ...` e a gente fica cego.

## Plano de ação

### 1. Implementar wrapper de erro SSR (essencial — isso é o que destrava tudo)

Criar 4 arquivos seguindo o padrão oficial do TanStack Start para Cloudflare workerd:

- **`src/server.ts`** — wrapper que faz `import()` lazy do server-entry do TanStack, envolve em `try/catch`, e normaliza qualquer Response 500 com `{"unhandled":true}` para uma página HTML legível, logando o erro real.
- **`src/lib/error-capture.ts`** — listeners `globalThis.error` / `unhandledrejection` para capturar exceções que o h3 engoliria silenciosamente; cache curto (5s) para correlacionar com a resposta.
- **`src/lib/error-page.ts`** — HTML autocontido (sem imports de app) com botões "Tentar novamente" e "Voltar".
- **`vite.config.ts`** — adicionar `tanstackStart: { server: { entry: "server" } }` para o plugin Vite usar nosso wrapper como entrada do worker.

Resultado: a partir da próxima build, o erro real aparece nos logs do container (`docker logs`) com stacktrace, e o usuário vê uma página branded em vez do `internal error; reference = ...`.

### 2. Blindar o `createInstance` com try/catch explícito + log

No `src/lib/whatsapp.functions.ts`, envolver o handler do `createInstance` (e de outras chamadas que tocam `bridge`) em `try { ... } catch (e) { console.error("[createInstance]", e); throw e; }` para garantir que o erro chegue nos logs antes do TanStack/h3 serializar.

### 3. Checklist de variáveis no Easypanel

No painel do Easypanel, na aba **Environment** do serviço, confirmar que **todas** estão preenchidas (não basta no `.env` do repo — o Docker runtime precisa delas):

- `SUPABASE_URL` = `https://pfppmkqsdqawvykkgafe.supabase.co`
- `SUPABASE_PUBLISHABLE_KEY` = a chave anon do projeto
- `SUPABASE_SERVICE_ROLE_KEY` = service role (sem isso `supabaseAdmin` quebra na primeira chamada — esse é o suspeito #1)
- `APP_BASE_URL` = URL pública do Easypanel (ex.: `https://fotodeapoio.radioradar.site`) para o webhook do WhatsHub apontar pro lugar certo
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` como **Build Args** (já estão no Dockerfile, mas precisam ser passados no Easypanel)

No Supabase, conferir que a Edge Function `whatsapp-bridge-proxy` tem o secret `WHATSHUB_MASTER_TOKEN` configurado.

### 4. Verificação

Após deploy, clicar "Iniciar Nova Conexão" novamente. Cenários esperados:
- **Sucesso** → instância criada normalmente.
- **Falha controlada** → toast com mensagem real (ex.: "WHATSHUB_MASTER_TOKEN missing") em vez de tela em branco.
- **Falha catastrófica** → página HTML branded; o erro real aparece nos logs do container (`docker logs <container>` no Easypanel).

## Detalhes técnicos

- Wrapper segue a referência oficial do TanStack para Cloudflare workerd; o lazy `import()` é fundamental porque erros de inicialização de módulo (ex.: `throw` no `client.server.ts` quando `SUPABASE_SERVICE_ROLE_KEY` falta) precisam ser capturáveis pelo `try/catch`.
- O ajuste em `vite.config.ts` é obrigatório: só mudar `wrangler.json` não basta porque o `@cloudflare/vite-plugin` reconstrói o entry a partir do virtual module do TanStack.
- Nenhuma alteração de schema do banco. Nenhuma quebra de API existente.

## Arquivos a alterar / criar

- **CRIAR** `src/server.ts`
- **CRIAR** `src/lib/error-capture.ts`
- **CRIAR** `src/lib/error-page.ts`
- **EDITAR** `vite.config.ts` (adicionar `tanstackStart.server.entry`)
- **EDITAR** `src/lib/whatsapp.functions.ts` (try/catch + log no `createInstance`)
- **EDITAR** `wrangler.jsonc` (opcional, alinhar `main` com `src/server.ts`)
