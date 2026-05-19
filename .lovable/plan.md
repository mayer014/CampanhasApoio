## Objetivo
Corrigir o chat do `/painel/whatsapp` para abrir na mensagem mais recente, permitir rolagem manual sem “puxar de volta” e carregar histórico antigo ao subir.

## Diagnóstico
- O `ChatPanel` hoje busca só os últimos 100 registros do cache local (`whatsapp_messages`), então o “início” real da conversa nunca fica acessível.
- Ao selecionar/enviar mensagens, o componente mistura recarga de dados com auto-scroll, o que explica abrir em posição errada ou travar a navegação manual.
- O layout pai principal parece aceitável; o gargalo mais forte está na estratégia de carregamento/ancoragem do scroll, não só em CSS.
- A server function `fetchMessages` aceita apenas `jid` + `limit`; não há suporte atual para paginação do histórico antigo.

## Plano
1. Ajustar a abertura da conversa
   - Separar claramente os cenários “abrir chat”, “chegou mensagem nova” e “usuário está navegando no histórico”.
   - Ao abrir uma conversa, posicionar explicitamente no final após a primeira renderização estável.
   - Impedir que updates posteriores forcem scroll quando o usuário estiver longe do rodapé.

2. Implementar histórico paginado para cima
   - Adicionar paginação no frontend usando `ts`/cursor da mensagem mais antiga carregada.
   - Buscar blocos anteriores no Supabase ao atingir o topo e prependar sem perder a posição visual.
   - Se necessário, estender `fetchMessages` para aceitar cursor/`before` e persistir mensagens mais antigas vindas do motor.

3. Corrigir a ancoragem do scroll
   - Preservar a posição ao prependar mensagens antigas (medindo `scrollHeight` antes/depois).
   - Manter auto-scroll apenas para abertura inicial e novas mensagens quando o usuário estiver perto do fim.
   - Evitar recargas completas desnecessárias após enviar mensagem, preferindo append/refresh controlado.

4. Validar no preview
   - Abrir uma conversa e confirmar que ela inicia na mensagem mais recente.
   - Subir manualmente e verificar que o scroll não volta sozinho.
   - Carregar mensagens antigas ao alcançar o topo e confirmar que dá para chegar ao começo da conversa.
