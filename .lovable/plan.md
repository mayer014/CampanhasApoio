## Objetivo
Tirar o módulo social do estado `degraded` sem continuar em tentativa e erro, separando com precisão se a falha está em:
- chave carregada em runtime
- cliente admin do Supabase
- gateway REST/PostgREST do Supabase
- endpoints públicos do crawler
- UI do `/painel/social`

## O que já ficou comprovado
- `SUPABASE_URL` existe e está resolvendo corretamente.
- `SUPABASE_SERVICE_ROLE_KEY` existe e está no formato `sb_secret`.
- O banco não está “quebrado”: as tabelas sociais existem e respondem por query direta.
- Há dados válidos no schema social (`social_profiles=1`, `social_system_state=1`).
- O erro acontece no caminho admin/REST usado pelos endpoints sociais, antes da lógica útil do módulo.
- O `/api/public/social/health` hoje mistura diagnóstico real com um `raw_probe` ainda insuficiente, então ele ajuda a ver a falha, mas não a localizar a causa com segurança.

## Plano de correção

### 1) Fechar o diagnóstico em um único ponto confiável
**Arquivos:**
- `src/integrations/supabase/client.server.ts`
- `src/lib/social.server.ts`
- `src/routes/api/public/social.health.ts`

**O que será feito:**
- Instrumentar o client admin com diagnóstico seguro: origem da URL, formato da chave, fingerprint mascarada da chave e modo de autenticação realmente usado.
- Reescrever o `raw_probe` para testar separadamente:
  - conectividade HTTP ao projeto Supabase
  - chamada REST com `apikey`
  - chamada via `supabaseAdmin.from(...).select(...)`
  - chamada RPC simples
- Fazer o `/health` devolver um relatório por etapa, em vez de apenas “internal error”.

**Resultado esperado:**
Um check único que responda exatamente qual camada falha.

### 2) Padronizar o acesso admin em todos os endpoints do módulo social
**Arquivos:**
- `src/routes/api/public/social.cron.ts`
- `src/routes/api/public/social.heartbeat.ts`
- `src/routes/api/public/social.next-job.ts`
- `src/routes/api/public/social.log.ts`
- `src/routes/api/public/social.ingest.ts`
- `src/lib/social.functions.server.ts`

**O que será feito:**
- Centralizar um padrão único de acesso admin para leitura, escrita e RPC.
- Remover diferenças de comportamento entre endpoints.
- Garantir que todos os endpoints registrem a mesma estrutura de erro com stage/route/operação.

**Resultado esperado:**
Se um endpoint falhar, saberemos se o problema é geral do admin client ou específico daquela operação.

### 3) Verificar incompatibilidade real entre `sb_secret` e o runtime atual
**Arquivos:**
- `src/integrations/supabase/client.server.ts`
- possivelmente `package.json` se o diagnóstico indicar incompatibilidade de versão

**O que será feito:**
- Confirmar se a versão atual do `@supabase/supabase-js` está usando o fluxo correto para `sb_secret` no runtime deste projeto.
- Se necessário, ajustar a criação do client admin para o modo compatível com secret key atual.
- Validar se o problema é chave carregada errada/stale ou comportamento da lib/gateway.

**Resultado esperado:**
Um admin client que consiga completar pelo menos uma leitura simples em `social_profiles` e uma RPC simples.

### 4) Separar “dashboard do painel” de “backend do crawler”
**Arquivos:**
- `src/lib/social.functions.ts`
- `src/routes/painel.social.tsx`
- componentes do painel social que dependem dos stats

**O que será feito:**
- Manter o painel utilizável com as rotas autenticadas/RPC já disponíveis sempre que possível.
- Mostrar estado operacional preciso no UI: por exemplo, “crawler backend indisponível” em vez de erro genérico.
- Evitar que uma falha do health público derrube toda a leitura do painel.

**Resultado esperado:**
O `/painel/social` volta a ser útil mesmo antes de todos os endpoints públicos estarem 100% recuperados.

### 5) Validar endpoint por endpoint com matriz de testes
**Endpoints alvo:**
- `/api/public/social/health`
- `/api/public/social/cron`
- `/api/public/social/heartbeat`
- `/api/public/social/next-job`
- `/api/public/social/log`
- `/api/public/social/ingest`

**O que será validado:**
- `health` sai de `degraded` ou passa a apontar a causa exata
- `cron` consegue enfileirar sem 500
- `heartbeat` grava em `social_workers`
- `next-job` consegue chamar `claim_next_social_job`
- `log` grava em `social_worker_logs`
- `ingest` conclui job e atualiza snapshots/posts

**Resultado esperado:**
Quebraremos o problema em 6 verificações pequenas, em vez de continuar rodando em círculo no erro agregado.

### 6) Plano de contingência se o gateway REST continuar falhando
**Sem mudar banco neste momento.**

Se, após o diagnóstico, ficar provado que:
- a chave está correta
- o banco responde
- mas REST/admin continua retornando `internal error`

então o próximo passo será:
- documentar a evidência com fingerprint mascarada + rota + referência dos erros
- trocar temporariamente o caminho de validação do painel para o que estiver funcionando
- abrir incidente objetivo no Supabase com provas reproduzíveis, sem perder mais horas em hipótese já descartada

## Ordem de execução
1. Corrigir o diagnóstico (`client.server.ts`, `social.server.ts`, `social.health.ts`)
2. Testar leitura simples + RPC simples com o admin client
3. Padronizar os 5 endpoints públicos do crawler
4. Blindar o `/painel/social` para não depender de um health impreciso
5. Validar a matriz completa de endpoints
6. Se necessário, escalar para incidente externo com evidência conclusiva

## O que não entra neste plano
- Não vou mexer no schema do banco agora, porque os sinais atuais não apontam para problema estrutural.
- Não vou criar Edge Functions novas; isso continua dentro de TanStack server routes/server functions.
- Não vou trocar coisa de UI fora do necessário para expor o estado real do backend.

## Critério de sucesso
Vamos considerar resolvido quando:
- o admin client completar pelo menos uma leitura simples e uma RPC simples
- `/api/public/social/health` deixar de ser um erro genérico
- o painel social carregar com diagnóstico claro
- os endpoints públicos principais responderem sem `internal error`
- a causa final ficar comprovada, não apenas “aparentemente corrigida”