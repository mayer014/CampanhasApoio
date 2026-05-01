# Cadastro público de candidatos + rastreio no dashboard

Hoje só o admin cria candidatos. Vamos abrir um cadastro público (qualquer pessoa do Brasil) que já entrega 5 fotos grátis e bloqueia automaticamente quando esgotar — o admin libera após pagamento. Tudo já existe na base (limite, bloqueio automático, função `set_active_template`, etc.); falta a porta de entrada pública e a leitura no dashboard.

## O que será criado

### 1. Página pública de cadastro `/cadastro`
- Formulário: nome completo, e-mail, telefone (BR), cidade/UF, senha (mín. 8).
- Envia para uma nova edge function pública `public-signup-candidate`.
- Após sucesso: faz login automático e redireciona para `/painel`.
- Link "Cadastre-se grátis" no header da home (`/`) e na tela `/login`.

### 2. Edge function `public-signup-candidate` (sem auth)
- Cria o usuário no Supabase Auth (e-mail confirmado automaticamente, para entrar direto).
- Cria `candidate_profiles` com:
  - `trial_limit = 5`, `is_blocked = false`
  - `slug` único derivado do nome
  - novos campos `city` e `state` salvos para segmentação
  - `signup_source = 'public'` (vs `'admin'` quando criado pelo painel admin)
- Cria role `candidate` em `user_roles`.
- NÃO cria `subscriptions` (assinatura só nasce quando admin libera após pagamento).
- Validações: e-mail válido, senha ≥ 8, telefone obrigatório, UF de 2 letras.
- Rate-limit simples: bloqueia +1 cadastro com o mesmo IP em < 30 s (best-effort, em memória).

### 3. Mudanças no banco (migração)
- `candidate_profiles`:
  - `city text`
  - `state text` (UF, 2 letras)
  - `signup_source text not null default 'admin'` (`'public'` para cadastros pela landing)
  - `unblocked_at timestamptz` — preenchido toda vez que o admin destrava o candidato (serve para diferenciar "nunca pagou" de "já foi cliente pagante").
- A edge function já existente `admin-create-candidate` continua usando `signup_source = 'admin'` (default).
- Trigger / coluna garantem que o auto-bloqueio em `increment_template_generation` continue funcionando — sem alteração na função.

### 4. Painel do candidato (`/painel`)
- Banner no topo quando `is_blocked = true`:
  - Título: "Seu trial gratuito acabou."
  - Texto: instruções para pagar via PIX e enviar comprovante pelo WhatsApp configurado em `app_settings`.
  - Botões: "Copiar chave PIX" e "Falar no WhatsApp" (`https://wa.me/<numero>`).
- Banner amarelo quando faltam ≤ 2 fotos do trial: "Restam X fotos grátis. Garanta o pagamento antes de bloquear."
- Não muda a navegação — só o conteúdo informativo.

### 5. Rastreio no dashboard admin (`/admin`)
Novos cards e gráficos sem remover os atuais:
- KPIs adicionais:
  - **Cadastros públicos** (total com `signup_source = 'public'`)
  - **Aguardando liberação** (candidatos com `is_blocked = true` E `signup_source = 'public'` E ainda sem assinatura ativa)
  - **Convertidos** (público que já foi liberado pelo menos uma vez — `unblocked_at IS NOT NULL`)
- **Cadastros por dia (últimos 30 dias)** — gráfico de linha, separando `public` vs `admin`.
- **Distribuição por estado (UF)** — gráfico de barras (Top 10 UFs).
- **Funil do trial** — barras: Cadastrados → Geraram ≥1 foto → Esgotaram trial → Pagaram (foram liberados).
- Lista "Aguardando liberação" com nome, cidade/UF, data do cadastro, link para `Gerenciar`.

### 6. Lista de candidatos (`/admin/candidatos`)
- Mostrar badge "Público" / "Admin" ao lado do nome (origem do cadastro).
- Filtro rápido: "Todos · Aguardando liberação · Ativos · Bloqueados".
- Mostrar cidade/UF abaixo do e-mail quando existir.

### 7. SEO da página pública
- Title, description, og: tags próprios em `/cadastro`.
- H1 único, semântica correta.

## Detalhes técnicos

- **Auth**: `supabase.auth.signUp` com `email_confirm: true` é feito via service role dentro da edge function (permitindo login imediato sem tela de confirmação). O cliente, após resposta de sucesso, chama `supabase.auth.signInWithPassword` no front com as credenciais que o usuário acabou de digitar.
- **Edge function pública**: `verify_jwt = false` no `supabase/config.toml` para a função `public-signup-candidate`.
- **Auto-bloqueio**: continua sendo feito por `increment_template_generation` (já implementado). Nada muda aqui.
- **Liberação após pagamento**: o admin já tem o switch rápido na lista de candidatos; o trigger desta liberação grava `unblocked_at = now()` (via update direto incluindo o campo no payload do toggle).
- **Métrica de conversão** = candidatos com `signup_source = 'public'` E `unblocked_at IS NOT NULL`.
- **Rate limit**: `Map<ip, lastTimestamp>` em memória do worker — best-effort, não substitui captcha. Se virar problema, depois evoluímos para Turnstile.

## O que não faz parte deste passo

- Captcha (Turnstile/hCaptcha) na página de cadastro — fica para depois se houver abuso.
- Confirmação de e-mail por link — ficaria no caminho do trial, queremos zero atrito.
- Pagamento online integrado — o fluxo atual segue PIX manual + liberação pelo admin.
- Histórico de blocks/unblocks (audit log) — por enquanto basta `unblocked_at` para a métrica.
