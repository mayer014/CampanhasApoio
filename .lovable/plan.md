## Objetivo

Reduzir bloqueios (ban) do WhatsApp em campanhas, evoluindo a tela "Nova campanha" e o worker de envio com camadas de proteção que imitam comportamento humano e respeitam as regras de uso do WhatsApp.

## Hoje já existe
- Intervalo aleatório mín/máx entre envios
- Limite diário (campanha + instância)
- Horário de silêncio
- Lista de opt-out (tabela `whatsapp_optouts`)
- Deduplicação de destinatários

## O que falta — propostas

### 1. Aquecimento (warm-up) progressivo da instância
Toda conta nova ou recém-reconectada começa com cap baixo e cresce ao longo de dias:
- Dia 1: 20 msgs, Dia 2: 40, Dia 3: 80… até o cap configurado
- Bloquear envios acima da cota de aquecimento, mostrando aviso no wizard
- Novos campos em `whatsapp_instances`: `warmup_started_at`, `warmup_day`, `warmup_enabled`

### 2. Spintax / variações de mensagem
Permitir sintaxe `{Olá|Oi|E aí} {nome}, {tudo bem|como vai}?` para gerar mensagens únicas por destinatário, evitando detecção de "mensagem em massa idêntica".
- Preview no wizard mostrando 3 variações de exemplo
- Validador: aviso se a mensagem não tem nenhuma variação

### 3. Simulação de digitação e presença
Antes de cada envio:
- Enviar `presence: composing` ao JID por N segundos proporcionais ao tamanho da mensagem (ex.: 40 caracteres/seg de "digitação")
- Pequena pausa "lida" entre composing e envio
- Campo `simulate_typing` na campanha

### 4. Janelas de envio (business hours) + pausas humanas
Além do quiet hours:
- Definir dias da semana permitidos (ex.: seg–sex)
- Janelas múltiplas por dia (ex.: 09:00–12:00 e 14:00–18:00)
- "Pausa para almoço" automática
- Micro-pausas aleatórias mais longas a cada N envios (ex.: a cada 25–40 envios, pausa de 5–15 min)

### 5. Rate limiting por hora + ramp-up dentro do dia
- Limite por hora além do diário (ex.: máx 40/h)
- Começar devagar nas primeiras horas (ramp-up) em vez de disparar tudo no início

### 6. Validação prévia de números (check)
Antes de incluir na fila, usar endpoint do bridge para verificar se o número existe no WhatsApp; marcar inválidos como `skipped` sem tentar enviar (números inválidos geram sinal forte de spam).
- Cache em `whatsapp_contacts.is_on_whatsapp` para não repetir checagem

### 7. Opt-out automático e palavras-chave
- Webhook de mensagens recebidas detecta palavras: "PARAR", "SAIR", "REMOVER", "DESCADASTRAR", "STOP"
- Insere automaticamente em `whatsapp_optouts`
- Rodapé opcional injetado: _"Responda SAIR para não receber mais."_

### 8. Detecção de bloqueios e circuit breaker
- Se taxa de falha > X% nas últimas N msgs OU código de erro do bridge indicar `forbidden`/`blocked`/`429`, pausar automaticamente a campanha e alertar
- Cooldown automático antes de retomar

### 9. Cooldown por destinatário entre campanhas
Não enviar para o mesmo JID se houve envio nas últimas X horas/dias (configurável). Evita "perseguição" do mesmo contato.
- Tabela `whatsapp_send_log` (ou query em `whatsapp_broadcast_recipients`) para checar último envio

### 10. Priorização e embaralhamento
- Embaralhar ordem dos destinatários (não enviar em sequência alfabética/numérica)
- Misturar conversas existentes primeiro (contatos com quem já houve troca têm risco menor)

### 11. Variação de mídia
- Quando há imagem, permitir 2–3 imagens em rotação aleatória, evitando hash idêntico repetido

### 12. Score de risco antes de criar
Mostrar no rodapé do wizard um indicador (Baixo/Médio/Alto) baseado em:
- Idade da instância vs warmup
- Tamanho da lista vs cap
- Intervalo configurado
- Uso de spintax/imagem
- % de números nunca contatados antes
Com sugestões de ajuste antes de "Criar e iniciar".

### 13. Confirmação de duplo opt-in (opcional)
Para listas frias (lista manual), oferecer fluxo de mensagem curta de confirmação antes do disparo real.

## Mudanças técnicas resumidas

### UI — `BroadcastsPanel.tsx` (Wizard)
- Acordeão "Proteção anti-banimento (avançado)" com:
  janelas de envio, dias da semana, pausa longa, limite/hora, typing, spintax preview, cooldown por destinatário, rodapé opt-out, rotação de mídia
- Card de "Score de risco" + recomendações
- Aviso de warm-up quando instância nova

### Backend — `whatsapp.server.ts` (worker)
- Estender lógica de seleção de próximo envio para considerar:
  warm-up cap, janela de horas, hora-rate, micro-pausas, cooldown por JID, shuffle
- Antes do `sendMessage`: `presence` composing
- Pós-envio: detectar erros de bloqueio → circuit breaker
- Renderizador de spintax + substituição de variáveis
- Validador de números (chamada ao bridge `check_number`)

### Banco — nova migration
- `whatsapp_broadcasts`: `hour_cap`, `allowed_weekdays int[]`, `daytime_windows jsonb`, `simulate_typing bool`, `long_pause_every int`, `long_pause_seconds_min/max`, `recipient_cooldown_hours`, `append_optout_footer bool`, `media_urls text[]`
- `whatsapp_instances`: `warmup_enabled`, `warmup_started_at`, `warmup_day`, `hour_cap`
- `whatsapp_contacts`: `is_on_whatsapp bool`, `last_checked_at`
- Trigger/função para incrementar warmup day a cada 24h

## Próximo passo
Posso priorizar e começar pelas camadas de maior impacto:
1. Spintax + footer opt-out + auto opt-out por palavra-chave
2. Warm-up + score de risco no wizard
3. Janelas/dias + hora-cap + micro-pausas
4. Typing + circuit breaker + cooldown por destinatário
5. Validação prévia de números + rotação de mídia

Quer que eu siga essa ordem ou prefere escolher um subconjunto?