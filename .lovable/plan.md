
# Módulo WhatsApp — Chat + Disparos em Massa

Integração com WhatsHub Bridge v4.7. Cada candidato conecta **sua própria instância** (isoladas por RLS). Admin vê e administra tudo.

---

## 1. Banco (Supabase — nova migration)

### Tabelas novas

- **`whatsapp_instances`** — 1 por candidato
  `id, candidate_id (unique), instance_id, name, phone_number, status (connecting|connected|disconnected), api_key (encrypted/server-only), webhook_registered, last_qr, last_connected_at, created_at, updated_at`

- **`whatsapp_contacts`** — cache de contatos sincronizados da agenda do WhatsApp
  `id, candidate_id, jid, name, push_name, phone, is_group(false), last_synced_at`

- **`whatsapp_groups`** — grupos que a instância participa
  `id, candidate_id, jid (@g.us), name, participants_count, is_favorite (bool), is_admin, last_message_at, last_synced_at`

- **`whatsapp_chats`** — lista de conversas (1:1 e grupos)
  `id, candidate_id, jid, name, is_group, unread_count, last_message_text, last_message_at, last_message_from_me`

- **`whatsapp_messages`** — histórico (cache do que chega via webhook + fetch_messages)
  `id, candidate_id, message_id (unique), jid, from_me, push_name, message_type, text, media_url, media_mime, media_filename, media_size, timestamp, created_at`
  *Índice em `(candidate_id, jid, timestamp desc)` e único em `(candidate_id, message_id)` para dedup.*

- **`whatsapp_broadcasts`** — campanhas de disparo em massa
  `id, candidate_id, name, message_text, media_url (nullable), target_type (contacts|groups|leads|manual_list), status (draft|running|paused|completed|failed), interval_min_seconds, interval_max_seconds, daily_cap, started_at, finished_at, total, sent_count, failed_count, created_at`

- **`whatsapp_broadcast_recipients`**
  `id, broadcast_id, jid, display_name, status (pending|sent|failed|skipped), sent_at, error_message, message_id`
  *Índice em `(broadcast_id, status)`*

- **`whatsapp_optouts`** — lista de bloqueio (anti-ban / LGPD)
  `id, candidate_id, jid, reason, created_at` — único em `(candidate_id, jid)`

- **`whatsapp_send_log`** — auditoria de TODO envio (para rate limit diário)
  `id, candidate_id, jid, broadcast_id (nullable), status, created_at`
  *Índice em `(candidate_id, created_at desc)`*

### RLS
- Candidato lê/escreve apenas onde `candidate_id = auth.uid()`.
- Admin (`has_role(auth.uid(), 'admin')`) gerencia tudo.
- `api_key` **nunca** é lido por client — só por server functions com `supabaseAdmin`.

---

## 2. Secrets (Supabase)

- `WHATSHUB_MASTER_TOKEN` — Master Token do WhatsHub (somente server, usado em `create_instance`).
- `WHATSHUB_BRIDGE_URL` — `https://vxqvrsaxppbgxookyimz.supabase.co/functions/v1/whatsapp-bridge`

---

## 3. Backend — Server Functions (TanStack)

Arquivo: `src/lib/whatsapp.functions.ts` (+ helpers em `src/lib/whatsapp.server.ts`).

Todas protegidas com `requireSupabaseAuth` + checagem de ownership (ou admin).

| Função | O que faz |
|---|---|
| `createInstance({ name })` | Chama `create_instance` com Master Token, salva `api_key` + cadastra webhook do app, retorna QR |
| `getInstanceStatus()` | `instance_status` → atualiza status no DB, devolve QR se `connecting` |
| `reconnectInstance()` | `reconnect` quando sessão cai |
| `disconnectInstance()` | `disconnect` |
| `syncChats()` | `chats` → upsert em `whatsapp_chats` + `whatsapp_groups` |
| `syncContacts()` | `contacts` → upsert em `whatsapp_contacts` |
| `fetchMessages({ jid, limit })` | `fetch_messages` → cache em `whatsapp_messages` |
| `sendMessage({ jid, text, mediaUrl? })` | `send` ou `send_media` (depende de mídia) com `normalizePhoneBR` se 1:1 |
| `toggleGroupFavorite({ groupId })` | flip `is_favorite` |
| `createBroadcast({ name, message, mediaUrl, targets, intervalMin, intervalMax, dailyCap })` | cria broadcast + recipients (status `draft`) |
| `startBroadcast({ id })` | muda status p/ `running` e dispara worker |
| `pauseBroadcast({ id })` | pausa |
| `addOptOut({ jid, reason })` / `removeOptOut` | gerencia bloqueio |
| `adminListInstances()` | só admin — lista todas |

### Endpoint público (webhook receiver)
`src/routes/api/public/whatsapp.webhook.ts` (POST)
- Sem auth (motor não envia bearer).
- Valida `instanceId` existe em `whatsapp_instances`, descobre `candidate_id`.
- Ignora `fromMe: true`.
- Dedup por `message_id` (insert com `ON CONFLICT DO NOTHING`).
- Insere em `whatsapp_messages`, atualiza `whatsapp_chats.last_message_*` e `unread_count`.
- Responde 200 em <1s.

### Worker de broadcast
Implementado como server function `processBroadcastBatch({ broadcast_id })` invocada por `pg_cron` a cada **30s**:
- Pega próximos N recipients `pending` do broadcast `running`.
- Para cada um: respeita intervalo aleatório `[intervalMin, intervalMax]`, checa daily cap em `whatsapp_send_log`, checa opt-out, envia, registra resultado, atualiza contadores.
- Se atingir cap diário ou receber `409 Instance not connected` → pausa broadcast e notifica.

---

## 4. Anti-banimento (camadas de proteção)

Conforme melhores práticas pro Baileys:

1. **Intervalo aleatório** entre mensagens (padrão `30–90s`, configurável por broadcast, mínimo 15s).
2. **Cap diário** por instância (padrão `200/dia`, configurável; warm-up: 50→100→200 nos 3 primeiros dias).
3. **"Modo aquecimento" automático** para instâncias com <7 dias: força caps progressivos.
4. **Pausa automática em janela de descanso** (configurável: 22h–7h por padrão).
5. **Opt-out obrigatório** — recipients em `whatsapp_optouts` são pulados (status `skipped`).
6. **Dedup de número** — não envia 2x o mesmo JID na mesma campanha.
7. **Detecção de ban** — se `instance_status` virar `disconnected` durante broadcast → pausa + alerta.
8. **Personalização** — suporte a `{nome}` no template (variabilidade reduz flag de spam).
9. **Pequena pausa extra a cada 50 envios** (5–10 min).
10. **Log de auditoria completo** em `whatsapp_send_log` para análise.

---

## 5. UI (Frontend)

### Sidebar — novo item "WhatsApp" em ambos os painéis (`/painel` e `/admin`)

### Rotas do candidato (`/painel/whatsapp/*`)

- **`/painel/whatsapp`** — Conexão da instância
  - Se sem instância: botão "Conectar WhatsApp" → cria + mostra QR code (polling do status a cada 3s).
  - Se conectada: telefone, status, botões "Reconectar" / "Desconectar".

- **`/painel/whatsapp/conversas`** — Chat tipo WhatsApp Web
  - Esquerda: lista de chats (busca, filtro 1:1/Grupo/Favoritos), badge unread.
  - Direita: mensagens do chat selecionado (texto + mídia inline via `mediaUrl`), input com anexo de imagem + botão enviar.
  - Botão "⭐" em grupos para favoritar.

- **`/painel/whatsapp/grupos`** — Gestão de grupos
  - Lista todos os grupos detectados, marca favoritos, conta participantes.
  - Botão "Sincronizar grupos" (chama `syncChats`).

- **`/painel/whatsapp/disparos`** — Campanhas
  - Listagem de broadcasts (status, progresso, sent/total).
  - "+ Nova campanha" → wizard:
    1. Nome + mensagem (com `{nome}`) + opcional imagem (upload pro bucket público existente).
    2. Selecionar destinatários:
       - **Eleitores cadastrados** (`voter_leads` com phone) — multi-select com filtro por bairro.
       - **Contatos do WhatsApp**.
       - **Grupos** (todos ou só favoritos).
       - **Lista manual** (cola números, um por linha).
    3. Configurar intervalo (slider min/max segundos), daily cap, janela de envio.
    4. Preview com total de destinatários estimados + tempo estimado.
    5. Salvar como rascunho ou iniciar.
  - Detalhe da campanha: progresso ao vivo, log de envios, pausar/retomar.

- **`/painel/whatsapp/optouts`** — Lista de bloqueios.

### Rotas admin (`/admin/whatsapp`)
- Visão geral: todas as instâncias dos candidatos, status, telefone, último envio, cap usado hoje.
- Drill-down em qualquer candidato (reusa as mesmas telas do painel do candidato em modo "como admin").

### Componentes
- `<WhatsAppChat />` — layout estilo WhatsApp Web (shadcn).
- `<QRCodeDisplay />` — exibe data-url, polling status.
- `<BroadcastWizard />` — multi-step usando shadcn `Dialog`/`Tabs`.
- `<RecipientPicker />` — combobox com tabs (Eleitores/Contatos/Grupos/Manual).

---

## 6. Agendamento (pg_cron)

Migration adicional para criar 2 jobs:

```sql
select cron.schedule('whatsapp-broadcast-tick', '*/30 * * * * *',
  $$ select net.http_post(
       url:='https://project--<id>.lovable.app/api/public/whatsapp/broadcast-tick',
       headers:='{"apikey": "<anon>"}'::jsonb,
       body:='{}'::jsonb
     ); $$);

select cron.schedule('whatsapp-status-sync', '*/5 * * * *',
  $$ select net.http_post(
       url:='https://project--<id>.lovable.app/api/public/whatsapp/status-sync',
       headers:='{"apikey": "<anon>"}'::jsonb,
       body:='{}'::jsonb
     ); $$);
```

Rotas em `src/routes/api/public/whatsapp.broadcast-tick.ts` e `whatsapp.status-sync.ts` que processam broadcasts ativos e atualizam status das instâncias.

---

## 7. Detalhes técnicos importantes

- Toda chamada à Bridge é **server-side** (server fn) — `api_key` nunca vai pro browser.
- `normalizePhoneBR()` em `src/lib/whatsapp.server.ts` aplicado antes de `send`/`send_media`.
- Upload de imagem do disparo: reutiliza bucket `template-layers` (já público) — subpasta `whatsapp-media/{candidate_id}/`. URL pública vai pro `media_url`.
- Webhook URL fixa: `https://project--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app/api/public/whatsapp/webhook` (URL estável da Lovable).
- Tudo em pt-BR.

---

## 8. Fora do escopo (avisos)

- Não implemento OCR/transcrição de áudio recebido (só armazena `mediaUrl`).
- Não faço envio agendado por horário específico (apenas "iniciar agora respeitando janela"). Pode ser adicionado depois.
- Não envio com botões interativos / templates aprovados (a API atual não cobre).
- **Assumi:** os "coordenadores/líderes" são os registros em `voter_leads`. Se você tem outra tabela para líderes (separada de eleitores), me avisa antes de eu começar que eu adiciono um seletor "Líderes" também.

---

## Ordem de implementação

1. Migration (todas as tabelas + RLS + pg_cron) — **aprovar primeiro**.
2. Secrets (`WHATSHUB_MASTER_TOKEN`).
3. Server functions + webhook receiver.
4. UI: conexão → conversas → grupos → disparos → optouts.
5. Versão admin (reusa componentes).
6. Testar com a instância já provisionada do guia.
