# Plano de correção do erro persistente no módulo social

## Objetivo
Eliminar o estado `degraded` do módulo social e parar o ciclo de tentativas cegas, isolando a causa real e aplicando uma correção verificável ponta a ponta.

## Diagnóstico fechado
A troca da chave foi só a primeira metade da correção.

O que já está confirmado:
- `SUPABASE_SERVICE_ROLE_KEY` agora está no formato correto: `sb_secret_...`
- `SUPABASE_URL` está presente e sendo resolvida corretamente
- `SOCIAL_HMAC_SECRET` está presente
- O banco existe e responde via leitura direta
- As tabelas sociais existem (`social_jobs`, `social_profiles`, `social_workers`, `social_system_state`)

O que continua quebrado:
- Todas as chamadas que passam por `supabaseAdmin` no módulo social falham com `internal error; reference = ...`
- O `raw_probe` também falha, então o problema acontece antes da lógica da rota terminar
- Isso aponta para o caminho de acesso administrativo ao Supabase REST, não para a key em si, nem para o HMAC, nem para a UI

## Hipótese principal
O cliente admin atual ainda está usando um fluxo de autenticação/cabeçalhos que não está compatível com o ambiente atual ao falar com o Supabase usando `sb_secret`, especialmente no runtime do Worker/Wrangler local-prod.

## O que vou implementar

### 1) Isolar o cliente admin do problema real
- Revisar `src/integrations/supabase/client.server.ts`
- Remover qualquer comportamento ambíguo de headers no client admin
- Padronizar o acesso server-only para `sb_secret` no formato mais simples e previsível possível
- Adicionar instrumentação de erro útil sem expor segredo

### 2) Criar uma prova diagnóstica confiável
- Melhorar `/api/public/social/health`
- Separar claramente falha de:
  - conexão HTTP
  - autenticação REST
  - query PostgREST
  - RPC
  - código da rota
- Incluir probes pequenos e determinísticos para cada camada

### 3) Tirar o módulo social da dependência frágil do caminho atual
- Revisar os endpoints:
  - `/api/public/social/health`
  - `/api/public/social/cron`
  - `/api/public/social/heartbeat`
  - `/api/public/social/next-job`
  - `/api/public/social/log`
  - `/api/public/social/ingest`
- Garantir que todos usem o mesmo caminho de acesso administrativo, sem variações ocultas

### 4) Verificar se o problema está no REST geral ou em RPCs específicos
- Testar separadamente:
  - leitura simples de tabela
  - contagem com `head: true`
  - `.maybeSingle()`
  - chamadas `rpc(...)`
- Se um padrão específico quebrar, reescrever só esse padrão no módulo social

### 5) Aplicar fallback robusto se o REST admin continuar instável
- Se o runtime continuar falhando com o client admin atual, migrar o módulo social para um acesso server-side alternativo e estável dentro do TanStack Start
- A ideia é manter a mesma funcionalidade, mas trocar o caminho de execução que hoje está gerando o `internal error`

### 6) Validar ponta a ponta
- Confirmar que `/api/public/social/health` deixa de retornar `degraded`
- Confirmar que:
  - cron enfileira jobs
  - worker heartbeat grava status
  - next-job consegue claimar job
  - ingest finaliza job sem 500
  - log grava eventos sem quebrar

## Entregáveis
- Correção no cliente administrativo do Supabase
- Health check mais preciso para diagnóstico real
- Ajustes nos endpoints públicos do módulo social
- Validação final com evidência de quais rotas voltaram a responder

## Ordem de execução
```text
1. Corrigir client.server.ts
2. Melhorar social.health.ts para diagnóstico por camada
3. Ajustar rotas sociais para usar o mesmo padrão estável
4. Testar reads + RPCs separadamente
5. Aplicar fallback se necessário
6. Validar health, cron, heartbeat, next-job, ingest e log
```

## Detalhes técnicos
- Arquivos principais:
  - `src/integrations/supabase/client.server.ts`
  - `src/routes/api/public/social.health.ts`
  - `src/routes/api/public/social.cron.ts`
  - `src/routes/api/public/social.heartbeat.ts`
  - `src/routes/api/public/social.next-job.ts`
  - `src/routes/api/public/social.log.ts`
  - `src/routes/api/public/social.ingest.ts`
- Não pretendo mexer no schema do banco neste primeiro ciclo, porque os dados e funções já existem
- O foco é corrigir a camada de acesso e depois validar cada operação

## Resultado esperado
Ao final, o módulo social deve sair do loop atual e voltar a operar com status íntegro, com diagnóstico claro caso ainda exista alguma falha residual.