
# Unificar tudo num monorepo só

## Diagnóstico (importante)

Olhando o Supabase deste projeto Lovable, ele JÁ tem as tabelas do site fotodeapoio (`templates`, `candidate_profiles`, `voter_leads`, `whatsapp_*`) **e** as tabelas do social-crawler (`social_jobs`, `social_profiles`, `social_workers`, etc).

Conclusão: **só existe 1 Supabase real** (`pfppmkqsdqawvykkgafe`). O que você chama de "Supabase do site" e o que o Lovable usa são o mesmo. Isso simplifica muito.

Então a confusão atual é só:
- **2 repos no GitHub** (site e worker) → vira **1 repo**
- **Worker depende do app publicado no Lovable** (chama `/api/public/social/*`) → passa a falar **direto com o Supabase**, eliminando o problema do `SUPABASE_SERVICE_ROLE_KEY` na VPS e parando de depender do `genesis-migration-hub.lovable.app`

## Arquitetura final

```text
GitHub: radioradar-site (monorepo)
├── apps/site/        ← código que o Lovable edita (TanStack atual)
│   ├── package.json
│   ├── src/
│   └── Dockerfile
├── apps/worker/      ← social-crawler (Node puro)
│   ├── package.json
│   ├── index.js
│   └── Dockerfile
├── package.json      ← raiz mínima (workspaces opcionais)
└── README.md

VPS (EasyPanel):
├── radioradar-site / fotodeapoio   → build apps/site,   domínio fotodeapoio.easychain.com.br
└── radioradar-site / social-crawler → build apps/worker, sem domínio

Supabase: pfppmkqsdqawvykkgafe (único, já existente)

Lovable: só edita arquivos dentro de apps/site/ e faz push automático no GitHub.
         O publish do Lovable fica DESLIGADO (URL genesis-migration-hub deixa de existir).
```

## Como o worker passa a funcionar

Hoje:
```
Worker (VPS) → HTTP → /api/public/social/* (Lovable publicado) → Supabase
                       ↑ depende do Lovable estar de pé e ter SERVICE_ROLE_KEY
```

Depois:
```
Worker (VPS) → @supabase/supabase-js (service_role) → Supabase
```

Vantagens:
- Worker não depende mais do Lovable estar publicado
- Não precisa de `SOCIAL_HMAC_SECRET`, nem de `/api/public/social/*`
- Service role key fica **só na VPS**, nunca no Lovable
- As 3 RPCs já existem no banco: `claim_next_social_job`, `complete_social_job`, `social_worker_heartbeat`

## Passos

### 1. Decisão sobre o repo
- Você adota o repo do **site** (`radioradar-site` provavelmente) como monorepo.
- Move o código atual do site pra `apps/site/` (1 commit).
- Cria pasta `apps/worker/` e cola o conteúdo do repo do social-crawler lá.
- Arquiva o repo antigo do social-crawler no GitHub.

### 2. Lovable passa a editar `apps/site/`
- Você reconecta este projeto Lovable ao repo unificado, apontando a raiz do projeto pra `apps/site/`.
- A partir daí, tudo que eu mudar aqui vai pra `apps/site/` no GitHub e o EasyPanel rebuilda o container do site.

### 3. EasyPanel: ajustar 2 serviços pro mesmo repo
- Serviço **fotodeapoio**: muda o build context pra `apps/site` (mantém domínio).
- Serviço **social-crawler**: muda o build context pra `apps/worker`.
- Push no repo dispara rebuild dos 2.

### 4. Reescrever o worker pra falar direto com Supabase
Substituo o `index.js` do worker por algo assim (resumido):
```js
import { createClient } from '@supabase/supabase-js'
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

setInterval(async () => {
  await sb.rpc('social_worker_heartbeat', { _worker_id: WORKER_ID, _status:'online', ... })
}, 30_000)

while (true) {
  const { data: jobs } = await sb.rpc('claim_next_social_job', { _worker_id: WORKER_ID })
  if (!jobs?.length) { await sleep(5000); continue }
  try { await processJob(jobs[0]); await sb.rpc('complete_social_job', { _job_id: jobs[0].id, _ok: true, _error: null }) }
  catch (e) { await sb.rpc('complete_social_job', { _job_id: jobs[0].id, _ok: false, _error: String(e) }) }
}
```

Envs do container worker (EasyPanel):
- `SUPABASE_URL=https://pfppmkqsdqawvykkgafe.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=<copiar do dashboard Supabase>`
- `WORKER_ID=worker-1`

### 5. Limpeza no site (apps/site)
- Removo as rotas `src/routes/api/public/social.*.ts` (deixam de ser usadas).
- Removo o secret `SOCIAL_HMAC_SECRET` se não for usado em outro lugar.
- Removo o `SUPABASE_SERVICE_ROLE_KEY` das envs do site no EasyPanel (site não precisa — usa o middleware autenticado por usuário).
- Botão **"Coletar agora"** no painel continua funcionando: ele só insere na tabela `social_jobs` via Supabase com a sessão do usuário; o worker pega na próxima volta do loop.

### 6. Desligar publish do Lovable
- Não usar mais `genesis-migration-hub.lovable.app`. Produção = `fotodeapoio.easychain.com.br`.
- Eu paro de te empurrar publish.

## O que muda no seu dia-a-dia

| Antes | Depois |
|---|---|
| 2 repos, 2 lugares pra mudar | 1 repo, 1 lugar |
| Lovable publica num domínio paralelo | Lovable só commita; quem serve é a VPS |
| Worker depende de URL do Lovable + SERVICE_ROLE no Lovable | Worker fala direto com Supabase |
| 3 conjuntos de envs pra sincronizar | 1 (site) + 1 (worker), simples |

## O que eu preciso de você antes de implementar

1. Confirmar o nome do repo do site no GitHub (vai virar o monorepo) — me passa o link.
2. Confirmar o nome/link do repo atual do social-crawler — pra eu saber o que migrar pra `apps/worker/`.
3. Idealmente colar o `index.js` e `package.json` atuais do worker (ou me dar acesso ao repo) — assim eu já te entrego o `apps/worker/` pronto, sem você ter que copiar nada manualmente.

Depois disso eu executo os passos 4 e 5 (código do worker novo + limpeza do site) num único commit, e você só ajusta o EasyPanel uma vez.
