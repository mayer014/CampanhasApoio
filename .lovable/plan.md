# Plano de ação para resolver o erro da VPS

## Diagnóstico principal
O problema é de **ambiente/runtime na VPS**, não do fluxo funcional do botão em si.

**Evidência concreta encontrada nos logs publicados:**
- `Missing Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY`
- isso já está derrubando rotas do módulo WhatsApp em produção
- o erro aparece junto do `supabaseAdmin` no runtime

Arquivos que sustentam isso:
- `src/integrations/supabase/client.server.ts` — lança erro fatal se `SUPABASE_SERVICE_ROLE_KEY` não existir
- `src/routes/api/public/whatsapp.broadcast-tick.ts` — já está falhando em produção por depender de `supabaseAdmin`
- `src/routes/api/public/whatsapp.webhook.ts` — também importa `supabaseAdmin` no topo e depende da mesma env
- `src/lib/whatsapp.server.ts` — o fluxo de bridge e webhook depende de `APP_BASE_URL` correto e da Edge Function `whatsapp-bridge-proxy`
- `src/lib/whatsapp.functions.ts` — o botão `Iniciar Nova Conexão` chama `createInstance`, que depende do bridge/proxy e de persistência consistente

## O que vamos fazer

### 1) Corrigir a configuração da VPS/EasyPanel
Garantir no **runtime** do container, não só no build:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_BASE_URL`

Valores esperados:
- `SUPABASE_URL` = URL do projeto Supabase
- `SUPABASE_PUBLISHABLE_KEY` = chave publishable/anon usada pelo app
- `SUPABASE_SERVICE_ROLE_KEY` = chave server-only
- `APP_BASE_URL` = domínio público real da VPS, usado para o webhook

Resultado esperado:
- parar os 500 atuais do módulo WhatsApp
- permitir persistência/admin queries sem crash silencioso

### 2) Blindar o fluxo de criação da instância para VPS
Revisar e endurecer o caminho:
- `ConnectionPanel -> createInstance -> bridge(master) -> whatsapp-bridge-proxy -> provider`

Ajustes previstos:
- capturar e expor erro real do proxy/bridge de forma controlada
- separar erro de configuração, erro de autenticação e erro do provedor
- evitar que qualquer exceção vire só `internal error; reference = ...`

Resultado esperado:
- se a criação falhar, a tela mostrará a causa real
- logs do servidor passarão a apontar o ponto exato da quebra

### 3) Validar a Edge Function `whatsapp-bridge-proxy`
Checar se a função está operacional e se o secret já existente está realmente utilizável em produção:
- `WHATSHUB_MASTER_TOKEN`
- autenticação via `Authorization: Bearer <access_token>`
- retorno JSON consistente do proxy

Resultado esperado:
- confirmar se a VPS falha antes do proxy, dentro do proxy, ou no provedor WhatsApp

### 4) Corrigir dependências que podem quebrar só na VPS
Temos dois pontos secundários que precisam ser eliminados para estabilizar o ambiente:
- rotas públicas do WhatsApp que importam `supabaseAdmin` no topo e morrem se a env faltar
- dependência do `APP_BASE_URL` para registrar webhook correto no provedor

Ação:
- revisar importações server-only críticas
- garantir fallback/erros explícitos onde fizer sentido
- validar URL final do webhook gerado

Resultado esperado:
- menos falhas catastróficas por diferença entre Lovable e VPS
- comportamento previsível no self-host

### 5) Verificação final ponta a ponta
Depois das correções, validar esta sequência:
1. clicar em `Iniciar Nova Conexão`
2. confirmar criação da instância no banco
3. confirmar resposta do bridge/proxy
4. confirmar retorno de `qrcode`
5. confirmar renderização do QR Code na tela
6. confirmar que webhook público responde sem crash

## Possíveis erros adicionais que podem continuar quebrando o trabalho
Além do `SUPABASE_SERVICE_ROLE_KEY`, estes são os candidatos mais prováveis:

1. **`APP_BASE_URL` incorreto**
- o provider recebe webhook errado
- a instância pode até ser criada, mas eventos não retornam corretamente

2. **proxy `whatsapp-bridge-proxy` com falha operacional**
- secret presente no Supabase mas função não respondendo como esperado
- erro JSON/timeout/rede mascarado pela VPS

3. **diferença entre build env e runtime env**
- `VITE_*` entra no build
- `SUPABASE_SERVICE_ROLE_KEY` e `APP_BASE_URL` precisam existir no container rodando

4. **crash silencioso por import server-only em rota pública**
- qualquer uso de `supabaseAdmin` sem env completa derruba endpoints relacionados

5. **resposta inválida do bridge/provedor**
- criação pode retornar sem `api_key`, sem `instance_id` ou sem `qrcode`
- hoje isso ainda pode virar erro genérico demais

## Entregável da implementação
Vou aplicar a correção em duas frentes:
- **estabilização do código** para erro real aparecer e o fluxo não morrer silenciosamente
- **checklist exato de variáveis e validação da VPS** para o deploy ficar definitivo

## Detalhes técnicos
```text
Botão UI
  -> createInstance (serverFn)
    -> userClientFromToken / resolveTargetCandidate
    -> bridge(master)
      -> Supabase Edge Function: whatsapp-bridge-proxy
        -> WhatsHub bridge/provider
    -> grava whatsapp_instances
    -> retorna qrcode/status
```

```text
Falha já comprovada em produção:
route/public whatsapp -> supabaseAdmin -> client.server.ts
-> SUPABASE_SERVICE_ROLE_KEY ausente
-> erro fatal no runtime da VPS
```

Se você aprovar, eu implemento agora a correção definitiva no código e te deixo também com o checklist exato da EasyPanel para subir sem voltar esse erro.