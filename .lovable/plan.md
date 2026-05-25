
# Passo 1 — Colocar o worker pra rodar (guia detalhista)

## O que eu já verifiquei (você não precisa fazer nada disso)

- ✅ Código do worker (`worker/index.js`, `worker/Dockerfile`, `worker/package.json`) está pronto e commitado no repo `mayer014/fotodeapoio`
- ✅ As 3 funções que o worker chama no Supabase existem: `social_worker_heartbeat`, `claim_next_social_job`, `complete_social_job`
- ✅ Tabelas necessárias existem: `social_jobs`, `social_profiles`, `social_posts`, `social_workers`, `social_worker_logs`, `social_system_state`, `social_post_snapshots`, `social_alerts`
- ✅ A função `record_social_snapshot` (chamada pelo worker depois de inserir posts) existe
- ✅ Endpoints HTTP antigos (`/api/public/social/*`) já foram apagados — não estorvam mais

**Conclusão:** falta apenas reconfigurar 1 container no EasyPanel. Nada de código novo, nada de migration, nada de secret novo.

---

## O que SÓ VOCÊ pode fazer (10 minutos)

Vou dividir em 3 partes pequenas. Faça uma de cada vez e me avise no fim de cada parte.

---

### Parte A — Pegar a chave `service_role` do Supabase

Essa chave é a única coisa secreta que falta. Ela vai morar nas envs do container do worker.

1. Abra: https://supabase.com/dashboard/project/pfppmkqsdqawvykkgafe/settings/api-keys
2. Procure a seção **"Project API keys"**
3. Encontre a linha **`service_role`** (cuidado: NÃO é a `anon` nem a `publishable`)
4. Clique no botão **"Reveal"** (ou no ícone de olho 👁) ao lado dela
5. Clique em **"Copy"** pra copiar a chave inteira (vai começar com `eyJhbGc...` e ter umas 200+ letras)
6. Cole num bloco de notas temporário — você vai usar daqui a pouco

⚠️ **Importante:** essa chave dá acesso TOTAL ao seu banco. Não publique em lugar nenhum. Só vai colar dentro do EasyPanel (que é seu, privado).

---

### Parte B — Reconfigurar o container no EasyPanel

1. Abra o EasyPanel (no seu navegador, onde você gerencia a VPS)
2. Entre no projeto onde está o container chamado **`social-crawler`** (o worker antigo)
3. Clique nele pra abrir os detalhes

**B.1 — Mudar o repositório de origem (aba "Source" ou "General"):**
- **Type/Tipo:** GitHub
- **Owner:** `mayer014`
- **Repository:** `fotodeapoio` (era `social-crawler` antes — TROCAR)
- **Branch:** `main`
- **Build Path / Path / Build Context:** `worker` (digitar exatamente isso, sem barra)
- **Dockerfile:** deixar como `Dockerfile` (padrão)

Clique em **Save** se tiver esse botão.

**B.2 — Configurar as variáveis de ambiente (aba "Environment" ou "Env"):**

Apague TODAS as envs atuais (eram pra arquitetura antiga). Adicione exatamente estas 3:

| Nome | Valor |
|------|-------|
| `SUPABASE_URL` | `https://pfppmkqsdqawvykkgafe.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (cole a chave que você copiou na Parte A) |
| `WORKER_ID` | `worker-1` |

Se houver `TARGET_URL`, `SOCIAL_HMAC_SECRET`, `POLL_INTERVAL_MS`, qualquer outra coisa — **apague**. O worker novo só precisa dessas 3.

Clique em **Save**.

**B.3 — Rebuildar e deploy:**
- Procure o botão **"Deploy"**, **"Rebuild"** ou **"Redeploy"** (geralmente no topo)
- Clique. Vai começar a baixar o repo novo e buildar o Dockerfile do `worker/`
- Espera 2–5 minutos (a primeira build é mais demorada porque baixa o Playwright + Chromium)

---

### Parte C — Validar nos logs

1. Ainda no container, abra a aba **"Logs"** (ou "Console")
2. Procure por essas linhas (em ordem):
   - ✅ `social-crawler v2 iniciado — worker=worker-1 supabase=https://pfppmkqsdqawvykkgafe.supabase.co`
   - ✅ Sem erros tipo `FATAL: SUPABASE_SERVICE_ROLE_KEY não definido`
   - ✅ Depois de alguns segundos, ou aparece processamento de jobs, ou silêncio (= sem jobs na fila, é normal)

3. **Copie os primeiros 30 linhas de log** e me cole aqui no chat.

Se aparecer qualquer linha com **`FATAL`**, **`erro`**, ou **`error`** — copia tudo e me manda. Eu te ajudo a corrigir.

---

## Resumo do que vai acontecer

```
ANTES                              DEPOIS
─────                              ──────
container social-crawler           mesmo container, agora apontando
└─ repo: social-crawler            └─ repo: fotodeapoio
└─ envs: TARGET_URL, HMAC...       └─ envs: SUPABASE_URL, SERVICE_ROLE, WORKER_ID
└─ fala HTTP com o site            └─ fala direto com Supabase
```

## Depois que funcionar (Passo 2 — depois, não agora)

- Arquivar repo `mayer014/social-crawler` no GitHub
- Remover secret `SOCIAL_HMAC_SECRET` do Supabase (não é mais usado)

Mas isso só depois que o worker estiver respondendo. Foca em A → B → C primeiro.

---

**Comece pela Parte A.** Quando tiver a chave copiada, me avisa e eu te oriento na Parte B em detalhes se travar em algum campo do EasyPanel.
