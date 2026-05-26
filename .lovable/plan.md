## Objetivo
Instrumentar o fluxo OAuth da Meta para expor o diagnóstico completo do token em produção e fechar a causa raiz de `/me/accounts` retornar vazio mesmo com seleção visual de Página/Instagram no popup.

## Achados já confirmados no código
- O `code` é trocado por token em `src/lib/meta-connect.functions.ts` dentro de `exchangeCodeAndSave()`.
- O `/me/accounts` já usa o **user access token** (na prática, o long-lived token após exchange, quando disponível), não o page token.
- O callback client-side valida `state` e chama `connectMetaAccount`, então o popup não abre mais `/_serverFn`.
- Hoje o diagnóstico já mostra apenas uma parte do token debug: `is_valid`, `app_id`, `user_id`, `scopes`, `granular_scopes`, `data_access_expires_at` e a resposta crua de `/me/accounts`.
- O frontend abre o OAuth com `buildMetaOAuthUrl({ state })` diretamente em `src/routes/painel.redes-sociais.tsx`.
- Há um ponto crítico: o `config_id` no frontend depende de `VITE_META_BUSINESS_LOGIN_CONFIG_ID`, enquanto o servidor já possui `META_BUSINESS_LOGIN_CONFIG_ID`. Se a variável pública não estiver presente em produção, o popup pode estar abrindo um fluxo híbrido/tradicional sem `config_id` válido.

## Hipóteses priorizadas
1. **`config_id` ausente ou incorreto no frontend publicado**
   - Sinal esperado: URL final do OAuth sem `config_id`, ou `debug_token` indicando token de fluxo diferente do Business Login esperado.
   - Impacto: o usuário vê seleção visual, mas o token final não recebe os assets/páginas.

2. **Token válido, porém sem asset grants efetivos**
   - Sinal esperado: `granular_scopes` sem `target_ids` relevantes, ou permissões concedidas sem vinculação às páginas.
   - Impacto: `/me/accounts` volta `200` com `data: []`.

3. **Troca `code -> token` ou `long-lived exchange` altera o contexto do token**
   - Sinal esperado: diferenças entre o `debug_token` do token curto e do long-lived (`type`, `application`, `issued_to`, `profile_id`, `scopes`, `granular_scopes`).
   - Impacto: o token inicial teria assets, mas o token usado no `/me/accounts` não.

4. **Conta/asset não elegível para o app em modo development / Business Manager**
   - Sinal esperado: token válido, mas usuário sem papel correto (admin/developer/tester) ou asset não atribuído ao Business app/system user.
   - Impacto: a UI da Meta mostra assets, mas a API não os entrega ao app.

5. **Mistura entre Facebook Login tradicional e Facebook Login for Business**
   - Sinal esperado: uso simultâneo de `scope` + fluxo de Business Login sem configuração consistente; resposta de `debug_token` incompatível com token esperado do Business flow.

## Plano de implementação
### 1) Expandir o diagnóstico do token no servidor
Adicionar logs e payload de erro com **todos** os campos relevantes retornados por `debug_token`, incluindo:
- `application`
- `type`
- `issued_at`
- `issued_to`
- `profile_id`
- `expires_at`
- `metadata`
- `scopes`
- `granular_scopes`
- `target_ids`
- `data_access_expires_at`
- JSON bruto completo do `debug_token`

### 2) Instrumentar as duas etapas do token
Executar e registrar `debug_token` em dois momentos:
- após o `code -> token` (token curto)
- após o `fb_exchange_token` (token long-lived, se existir)

Isso vai mostrar se a troca para long-lived está “perdendo” asset context.

### 3) Registrar a chamada de `/me/accounts` com máxima visibilidade
Antes de salvar a conexão, registrar:
- URL chamada
- token usado (apenas fingerprint/parcial segura, nunca completo em tela)
- status HTTP
- headers relevantes da resposta
- corpo bruto completo
- quantidade de páginas retornadas
- erros completos, se houver

### 4) Expor o diagnóstico completo na tela do callback
Ampliar `/auth/meta/callback` para mostrar, sem exibir o token:
- `application`, `type`, `issued_to`, `profile_id`, `expires_at`
- debug do token curto e do long-lived lado a lado
- `granular_scopes` completos
- `target_ids` extraídos por permissão
- resposta bruta e headers de `/me/accounts`
- indicador claro se `config_id` foi usado para abrir o OAuth

### 5) Corrigir a origem da URL OAuth
Parar de depender apenas de `VITE_META_BUSINESS_LOGIN_CONFIG_ID` no cliente e fazer o botão obter do servidor a configuração efetiva do OAuth (`state + configId` ou a URL final pronta).

Objetivo:
- garantir que a URL publicada sempre use o `config_id` do ambiente real do servidor
- eliminar a hipótese de preview/publicado divergirem no parâmetro mais importante do Business Login

### 6) Validar o fluxo publicado
Verificar no build publicado:
- se a URL aberta contém `response_type=code`
- se contém `client_id=2042324250036581`
- se contém `redirect_uri=https://fotodeapoio.easychain.com.br/auth/meta/callback`
- se contém `config_id` quando o Business Login estiver habilitado
- se o `state` confere com o salvo localmente

## Resultado esperado
Após essa instrumentação, teremos evidência suficiente para separar de forma objetiva:
- problema de `config_id` / fluxo errado
- problema de permissões granulares sem assets
- problema no exchange para long-lived token
- problema de papel/asset no Business Manager / modo development
- problema/bug da própria Meta no `/me/accounts`

## Entrega técnica
Vou concentrar as mudanças em:
- `src/lib/meta-connect.functions.ts`
- `src/routes/auth.meta.callback.tsx`
- `src/routes/painel.redes-sociais.tsx`
- possivelmente `src/lib/meta-oauth.ts`

## Critério de sucesso
Você conseguirá ver, no callback e nos logs, o diagnóstico bruto completo da Meta e eu consigo te devolver hipóteses confirmadas/refutadas com base em dados reais do token, não em suposição.