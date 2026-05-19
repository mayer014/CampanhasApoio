## Diagnóstico

Mesmo problema da conexão, agora replicado em **todas** as tabelas de dados do WhatsApp: as policies de RLS só permitem que **administradores** insiram, e dão ao dono apenas `SELECT`/`UPDATE`. Os botões "Sincronizar" e o carregamento de mensagens chamam `.upsert(...)` no banco com o cliente autenticado como candidato — o Postgres rejeita silenciosamente e nada aparece na UI.

Tabelas afetadas (faltando INSERT pro dono):

- `whatsapp_chats` — sincronização de conversas
- `whatsapp_groups` — sincronização de grupos
- `whatsapp_contacts` — sincronização de contatos
- `whatsapp_messages` — cache local de mensagens (lidas/enviadas)
- `whatsapp_send_log` — log de envios (usado para cap diário)
- `whatsapp_broadcast_recipients` — destinatários ao criar disparos

E também faltam algumas regras complementares:

- `whatsapp_chats` precisa de `DELETE` pro dono (caso de limpar conversa antiga — opcional, posso deixar fora se preferir).
- `whatsapp_send_log` precisa só de INSERT (UPDATE/DELETE não fazem sentido).

## O que vou fazer

**Uma migration única** adicionando as policies de INSERT (e WITH CHECK = `candidate_id = auth.uid()`) nas 6 tabelas acima. Sem mudança em código de aplicação.

Depois disso o fluxo passa a funcionar:

```
clicar "Sincronizar"
   → syncChats / syncContacts (server fn)
   → bridge motor traz chats/contatos
   → upsert em whatsapp_chats / whatsapp_groups / whatsapp_contacts ✔
   → realtime do Supabase atualiza a UI ✔

abrir conversa
   → fetchMessages → motor → upsert em whatsapp_messages ✔
   → ChatPanel exibe ✔

enviar mensagem
   → sendMessage → motor → upsert em whatsapp_messages + insert em whatsapp_send_log ✔
```

## Pós-implementação (passos do usuário)

1. Aprovar a migration.
2. Recarregar `/painel/whatsapp`.
3. Clicar em **Sincronizar** (botão de refresh na lista de conversas) — deve trazer chats e grupos imediatamente.
4. Abrir uma conversa — mensagens vão carregar e novas mensagens chegam em tempo real conforme o motor da VPS dispara o webhook.

## Por que isso não foi pego antes

Quando o módulo foi migrado pra usar `userClientFromToken` (cliente escopado ao usuário, sem service-role), as policies originais — escritas pensando num cliente admin — passaram a bloquear todas as gravações silenciosas (upserts). A correção da conexão revelou a primeira camada do problema (instância); essa migration completa o resto.

## Observação

O webhook público (`/api/public/whatsapp/webhook`) já usa `supabaseAdmin` (bypassa RLS), então mensagens recebidas em tempo real **já funcionariam** assim que o motor da VPS chamar o webhook. Vale conferir, depois das policies, se o motor está postando para `https://project--7a279b36-7b6b-4e1c-bf0e-253f1a812c48.lovable.app/api/public/whatsapp/webhook` — se não estiver, mensagens novas só aparecem após clicar em "Sincronizar" ou abrir o chat (fetch ativo).