# Migração do Profile Pic Creator

Migrar tudo do projeto **Profile Pic Creator** (workspace) para este projeto novo, mantendo a stack TanStack Start + Supabase.

## 1. Banco de dados (migration única)

Replicar exatamente o schema do projeto original:

- **Enum** `app_role` ('admin', 'candidate')
- **Tabelas** (todas com RLS habilitado):
  - `user_roles` — papéis dos usuários
  - `candidate_profiles` — dados do candidato + slug público + flag bloqueado
  - `templates` — camadas (background/círculo/elemento/logo) com transforms JSONB + photo_circle + contador
  - `voter_leads` — nome, telefone, rua, número, bairro
  - `payments` — valor, data, método, observação
  - `subscriptions` — status, vencimento, valor mensal
- **Funções** (todas SECURITY DEFINER, search_path fixo):
  - `has_role(uuid, app_role)` → boolean
  - `set_active_template(uuid)` → garante 1 template ativo por candidato
  - `increment_template_generation(uuid)` → contador público
  - `touch_updated_at()` → trigger genérico
- **Triggers** `tg_*_updated` em candidate_profiles, templates, subscriptions
- **RLS policies** completas:
  - Admin gerencia tudo via `has_role`
  - Candidato lê/atualiza só os próprios registros
  - Público (anon) lê candidatos não bloqueados, lê templates ativos, insere leads
- **Grants** restritos: `has_role`/`set_active_template` → authenticated; `increment_template_generation` → anon + authenticated
- **Storage bucket** `template-layers` (público), com policies: leitura pública por arquivo, escrita/update/delete só admin

## 2. Edge Functions → Server Functions (TanStack Start)

Converter as 2 edge functions Deno em `createServerFn` usando `supabaseAdmin`:

- `src/server/admin.functions.ts`:
  - `bootstrapAdmin()` — promove o usuário atual a admin se ainda não existir nenhum admin
  - `adminCreateCandidate({ email, password, full_name, phone, slug, monthly_amount, due_date })` — protegida por `requireSupabaseAuth` + verificação `has_role('admin')`, cria usuário via `supabaseAdmin.auth.admin.createUser` (email_confirm: true), insere em `candidate_profiles`, `user_roles`, `subscriptions`
- `src/server/admin.server.ts` — helpers internos (validação Zod, criação)

## 3. Frontend

Copiar arquivos do projeto original para cá, ajustando imports onde necessário:

- **Rotas** (`src/routes/`):
  - `index.tsx`, `login.tsx`, `p.$slug.tsx`
  - `admin.tsx` (layout) + `admin.index.tsx`, `admin.candidatos.index.tsx`, `admin.candidatos.$id.tsx`, `admin.candidatos.$id.template.$tplId.tsx`
  - `painel.tsx` (layout) + `painel.index.tsx`, `painel.templates.tsx`, `painel.leads.tsx`, `painel.link.tsx`
  - Substituir chamadas a `supabase.functions.invoke('bootstrap-admin'|'admin-create-candidate')` pelas server functions novas
- **Componentes**: `src/components/template-canvas.tsx`
- **Lib**: `src/lib/template-renderer.ts`
- **Hook**: `src/hooks/use-auth.ts`
- **Plano**: `.lovable/plan.md`
- **Supabase client**: usar o `src/integrations/supabase/client.ts` já existente neste projeto (não copiar do antigo, pois aponta para outro projeto Supabase)

## 4. Dependências npm

Instalar via `bun add` o que faltar (provavelmente já está tudo aqui, validar):
`@hookform/resolvers`, `react-hook-form`, `zod`, `date-fns`, `sonner`, demais Radix usados pelos componentes shadcn já existentes.

## 5. Auth

- Email/Password já vem habilitado por padrão no Supabase
- **Google OAuth** e **desligar auto-confirm de email** precisam ser configurados manualmente no Dashboard do Supabase (não dá pra fazer via código). Vou deixar instruções claras no final com os links diretos:
  - https://supabase.com/dashboard/project/pfppmkqsdqawvykkgafe/auth/providers (habilitar Google)
  - https://supabase.com/dashboard/project/pfppmkqsdqawvykkgafe/auth/providers (desligar "Confirm email" no provider Email)

## 6. Ordem de execução

```text
1. Rodar migration (schema + funções + RLS + storage bucket + policies)
2. Criar src/server/admin.{server,functions}.ts
3. Copiar lib/template-renderer.ts, hooks/use-auth.ts, components/template-canvas.tsx
4. Copiar todas as rotas, ajustando os 2 pontos onde havia .functions.invoke()
5. Copiar .lovable/plan.md
6. Verificar build
7. Instruir usuário a configurar Google OAuth e desligar auto-confirm
```

## Detalhes técnicos

- Loaders TanStack são isomórficos → toda chamada que precise de service_role vai em `createServerFn`
- `supabaseAdmin` só em arquivos `*.server.ts` / dentro de `.handler()` de server functions
- `bootstrap-admin` original era pública (sem auth) e só funcionava se nenhum admin existisse — manter essa semântica e proteger com check no handler
- `admin-create-candidate` original exigia JWT de admin — usar `requireSupabaseAuth` + verificação `has_role('admin')` no contexto
- Não copiar `src/integrations/supabase/client.ts` do projeto antigo (aponta para outro Supabase) — usar o já existente neste projeto
- Não copiar `supabase/config.toml`, `package.json`, `vite.config.ts`, `routeTree.gen.ts` (gerado), `styles.css` (manter o atual e só ajustar tokens se necessário)
