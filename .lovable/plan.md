## Objetivo
Fazer conversas, grupos e mensagens aparecerem no `/painel/whatsapp`, já que a conexão está ativa e os contatos estão sincronizando, mas chats/grupos/mensagens seguem vazios.

## O que já foi confirmado
- A instância WhatsApp está **conectada** no banco.
- A tabela `whatsapp_contacts` já recebeu **7.560 contatos**, então autenticação, token e parte do bridge estão funcionando.
- As tabelas `whatsapp_chats`, `whatsapp_groups` e `whatsapp_messages` continuam com **0 registros**.
- As políticas RLS de criação que faltavam já existem; portanto o bloqueio principal agora **não é mais RLS básico**.
- As constraints únicas para `upsert` existem no banco, então o problema **não é falta de índice/unique key**.

## Plano
1. **Corrigir a camada de sincronização de chats/mensagens**
   - Revisar `syncChats` e `fetchMessages` para aceitar o formato real retornado pelo motor/bridge.
   - Tratar variações de payload (`res.chats`, `res.data`, listas vazias, nomes de campos diferentes como `is_group`, `remoteJid`, `conversation`, etc.).
   - Parar de falhar silenciosamente: toda gravação no Supabase deve verificar `error` e lançar mensagem útil.

2. **Adicionar diagnóstico explícito no backend**
   - Registrar quantos chats/mensagens vieram do bridge e quantos foram persistidos.
   - Logar erros de `upsert/insert` por tabela (`whatsapp_chats`, `whatsapp_groups`, `whatsapp_messages`).
   - Retornar no server function um resumo técnico (`recebidos`, `gravados`, `ignorados`, `erro`) para o frontend.

3. **Consertar a estrutura do módulo WhatsApp**
   - Separar `src/lib/whatsapp.functions.ts` em wrappers finos de server function e helpers server-only.
   - Mover `tickBroadcastsInternal` e qualquer uso de `client.server` para arquivo `*.server.ts` próprio.
   - Isso elimina o vazamento transitive import client/server que já está aparecendo nos logs do dev-server e reduz comportamento inconsistente.

4. **Melhorar a validação no frontend**
   - Fazer o botão de sincronizar mostrar o resultado real: por exemplo “0 chats recebidos do motor” em vez de sempre “Conversas sincronizadas”.
   - Exibir falha real se o backend não gravar nada.
   - Recarregar chats/grupos só quando houver persistência confirmada.

5. **Validar ponta a ponta**
   - Rodar sincronização novamente.
   - Confirmar no banco que `whatsapp_chats` e `whatsapp_groups` passaram a ter registros.
   - Abrir uma conversa e validar que `fetchMessages` popula `whatsapp_messages` e renderiza no painel.

## Detalhes técnicos
- O sinal mais forte é este: **contatos entram, chats não entram**. Isso normalmente indica incompatibilidade entre o payload do endpoint `chats/fetch_messages` e o mapeamento atual do código — não falha geral de autenticação.
- Também há um problema estrutural no arquivo `src/lib/whatsapp.functions.ts`: ele mistura server functions chamadas pelo cliente com lógica server-only/admin. Os logs já mostram imports transitivos problemáticos envolvendo `client.server.ts` e `whatsapp.server.ts`.
- Não pretendo mexer no visual nem em fluxos fora do WhatsApp; a correção ficará focada em sincronização, persistência e feedback de erro.

## Resultado esperado
Depois da implementação:
- **Sincronizar** deve popular conversas e grupos.
- Abrir uma conversa deve trazer e salvar mensagens.
- O painel deve mostrar erro verdadeiro quando o motor devolver formato inesperado ou quando a gravação falhar.
- O módulo WhatsApp fica estável e mais fácil de depurar nas próximas falhas.