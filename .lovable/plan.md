## Objetivo
Corrigir o chat do `/painel/whatsapp` para abrir sempre na mensagem mais recente, permitir rolagem manual sem “puxar de volta” e carregar o histórico antigo quando você subir a conversa.

## Plano
1. **Ajustar a abertura da conversa**
   - Separar o comportamento de “abrir chat” do comportamento de “nova mensagem chegando”.
   - Fazer a conversa abrir ancorada no fim apenas na primeira carga da conversa.
   - Evitar reposicionamento automático depois que o usuário começar a navegar manualmente.

2. **Consertar o scroll interno**
   - Revisar a lógica de `scrollRef`, `isNearBottom` e `stickToBottomRef` para não disparar auto-scroll em momentos errados.
   - Preservar a posição do usuário ao atualizar a lista de mensagens.
   - Garantir que o container de mensagens seja o único responsável pela rolagem do chat.

3. **Adicionar histórico paginado para cima**
   - Carregar os últimos itens ao abrir a conversa.
   - Ao chegar no topo, buscar mensagens mais antigas no banco e inseri-las no início da lista.
   - Manter a posição visual estável ao prependar mensagens antigas, sem “pular” a tela.

4. **Estender a busca de mensagens se necessário**
   - Se o cache local não tiver histórico suficiente, ajustar `fetchMessages` para aceitar paginação/cursor de mensagens antigas.
   - Persistir os blocos antigos recebidos para que o histórico continue acessível nas próximas aberturas.

5. **Validar no preview**
   - Confirmar que a conversa abre na mensagem mais recente.
   - Confirmar que dá para subir manualmente sem o chat voltar sozinho.
   - Confirmar que o topo carrega histórico antigo e que dá para chegar ao começo da conversa.

## Detalhes técnicos
- Hoje o `ChatPanel` carrega só uma janela curta do histórico local, então o início real da conversa não fica disponível.
- A lógica atual mistura recarga de mensagens e auto-scroll, o que explica o comportamento instável.
- A correção ficará focada em `src/components/whatsapp/ChatPanel.tsx` e, se necessário, em `src/lib/whatsapp.functions.ts` para paginação do backend.