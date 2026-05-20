## Objetivo
Parar a oscilação de erros na Inteligência Social e transformar o fluxo em algo previsível no login, na abertura da aba e no cadastro de perfis.

## Diagnóstico consolidado
Hoje o problema parece ser uma combinação de fatores, não um bug isolado:

1. **Autenticação de server functions está incompleta no app**
   - Existe `src/integrations/supabase/auth-attacher.ts`.
   - **Não encontrei `src/start.ts` nem registro de `functionMiddleware`/`attachSupabaseAuth`**.
   - Isso indica que a arquitetura de autenticação padrão do TanStack Start não está fechada.

2. **O módulo social usa um fluxo paralelo/manual de token**
   - `painel.social.tsx` pega token via `useAccessToken()`.
   - `social.functions.ts` usa `access_token` manual + `userClientFromToken()` + decode local de JWT.
   - Isso evita parte do problema, mas cria outro: **sessão, role e token podem ficar fora de sincronia logo após login**.

3. **Há dependência forte de runtime/env e de objetos do banco que talvez não estejam 100% alinhados no ambiente ativo**
   - O módulo depende de `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, RPCs e tabelas do social.
   - Já houve indício anterior de `hasSupabaseServiceRoleKey: false`.
   - Não consegui validar o banco pelo shell porque **não há acesso PG nesta sessão** (`PGHOST_MISSING`).

4. **A aba “Operação” depende de RPC e estado global do social**
   - `getSocialOpsStats()` chama `social_dashboard_stats()`.
   - Se faltar função, permissão, tabela auxiliar ou linha base em `social_system_state`, a aba quebra.

5. **Há pouca observabilidade útil no ambiente atual**
   - Não vieram logs de runtime pelo agregador agora.
   - Sem uma rota de diagnóstico forte, o sistema cai em “internal error; reference = ...” e mascara a causa real.

## Plano de implementação

### Fase 1 — Fechar a fundação de autenticação
1. **Criar/ajustar a bootstrap do TanStack Start**
   - Registrar `attachSupabaseAuth` no `functionMiddleware`.
   - Garantir que server functions autenticadas recebam o bearer token automaticamente.

2. **Padronizar o gate de autenticação das rotas do painel**
   - Evitar que `/painel` e `/painel/social` renderizem enquanto sessão e role ainda estão hidratando.
   - Invalidar router/cache em mudanças de auth no root.

3. **Parar de depender de token manual nas server functions do social**
   - Migrar `social.functions.ts` para `requireSupabaseAuth`.
   - Ler `userId`/`supabase` do contexto autenticado do servidor, em vez de transportar `access_token` pelo componente.

### Fase 2 — Reestruturar o backend do módulo social
1. **Separar responsabilidades**
   - Manter `.functions.ts` só como camada RPC.
   - Mover lógica pesada/diagnóstico para `.server.ts` específicos.

2. **Remover pontos frágeis do fluxo atual**
   - Reduzir uso de `userIdFromToken()` e `userClientFromToken()` onde não for mais necessário.
   - Garantir respostas sempre serializáveis e homogêneas (`{ ok, message, details }`).

3. **Blindar chamadas que hoje podem explodir no runtime**
   - Tratar explicitamente RPC ausente, permissão insuficiente, tabela sem seed, conflito duplicado e secret ausente.
   - Evitar qualquer throw bruto que volte como “internal error”.

### Fase 3 — Validar o contrato de banco e ambiente
1. **Auditar o estado real do Supabase do projeto**
   - Confirmar existência de:
     - `social_profiles`
     - `social_jobs`
     - `social_alerts`
     - `social_workers`
     - `social_worker_logs`
     - `social_system_state`
     - funções `social_dashboard_stats`, `claim_next_social_job`, `enqueue_due_social_profiles`, `complete_social_job`
   - Confirmar que `social_system_state` tem a linha `id = 1`.

2. **Revisar permissões/RLS**
   - Confirmar que candidatos conseguem operar em `social_profiles` e `social_alerts`.
   - Confirmar que RPCs e jobs administrativos estão corretos para `service_role`.

3. **Confirmar secrets no runtime ativo**
   - Validar `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SOCIAL_HMAC_SECRET` no ambiente que realmente atende preview/publicação.

### Fase 4 — Criar diagnóstico confiável e UX estável
1. **Adicionar diagnóstico operacional do social**
   - Uma resposta clara para diferenciar:
     - sessão inválida
     - role ausente
     - secret ausente
     - migration faltando
     - RPC faltando
     - RLS bloqueando
     - worker offline

2. **Melhorar estados da UI**
   - “Sessão carregando”
   - “Ambiente social incompleto”
   - “Sem worker ativo”
   - “Fila indisponível”
   - “Perfil já cadastrado”
   - sem toast genérico em loop

3. **Parar polling enquanto pré-requisitos não estiverem prontos**
   - Só consultar stats/alerts quando sessão, role e módulo estiverem estáveis.

### Fase 5 — Validação final ponta a ponta
Executar a sequência real:
1. login
2. abrir `/painel/social`
3. entrar na aba Operação
4. entrar na aba Perfis
5. cadastrar perfil novo
6. cadastrar perfil duplicado
7. forçar coleta
8. validar respostas sem “internal error; reference”

## O que eu acredito que está faltando hoje
As lacunas mais prováveis são estas:

- **bootstrap de autenticação incompleta do TanStack Start**
- **fluxo social improvisado com token manual, sujeito a corrida de sessão após login**
- **algum descompasso entre código, migrations aplicadas e secrets disponíveis no runtime real**
- **falta de diagnóstico determinístico para separar erro de app, erro de RLS, erro de RPC e erro de env**

## Entrega esperada depois da implementação
- Login não dispara erro oscilante na Inteligência Social.
- A aba Operação abre com estado claro, mesmo se não houver worker.
- Cadastro de perfil responde sempre com mensagem legível.
- Falta de secret/migration vira erro explícito e rastreável.
- O módulo deixa de depender de truques de token manual e fica alinhado com o padrão correto do stack.

## Detalhes técnicos
- Arquivos principais a revisar/ajustar:
  - `src/routes/painel.social.tsx`
  - `src/components/social/SocialOpsPanel.tsx`
  - `src/components/social/SocialProfilesPanel.tsx`
  - `src/lib/social.functions.ts`
  - `src/lib/social.server.ts`
  - `src/lib/whatsapp.server.ts`
  - `src/routes/__root.tsx`
  - bootstrap do TanStack Start (`src/start.ts` ou equivalente ausente)
- Banco/migrations a validar:
  - `supabase/migrations/20260520180142_1a3576ee-371c-45bd-ba9a-25f3170079ba.sql`
  - `supabase/migrations/20260520181651_4c2f00f6-5a9c-4cc2-a2c1-f3f4335aa051.sql`

## Resultado do plano
Vou atacar primeiro a **fundação** (auth + bootstrap + contrato do banco), depois o **módulo social**, e só então a **UI**. Isso evita continuar corrigindo sintomas enquanto a base ainda está inconsistente.