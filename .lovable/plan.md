## Por que esse projeto pede env e o outro não

Olhando o print que você mandou: o outro projeto **só tem `VITE_SUPABASE_*`** no EasyPanel. Nenhum `WHATSHUB_MASTER_TOKEN`. Isso só é possível porque, naquele projeto, **quem fala com o bridge do WhatsHub é uma Edge Function da Supabase** — e o token mora como secret **na Supabase**, não no servidor do app.

Neste projeto aqui o caminho foi montado diferente: o backend TanStack (rodando no seu container do EasyPanel) chama o bridge direto. Por isso ele exige `WHATSHUB_MASTER_TOKEN` no runtime do EasyPanel — e é por isso que estamos sofrendo com env.

Fluxo atual (ruim):
```text
Navegador → TanStack server (EasyPanel) ──[X-Bridge-Token]──> WhatsHub Bridge
                              ↑
                              precisa do token no EasyPanel
```

Fluxo do outro projeto (bom):
```text
Navegador → TanStack server → Supabase Edge Function ──[X-Bridge-Token]──> WhatsHub Bridge
                                       ↑
                                       token é secret da Supabase (já existe!)
```

O segredo `WHATSHUB_MASTER_TOKEN` **já está cadastrado na Supabase** deste projeto. Não precisa mexer em EasyPanel nenhum.

## O que eu proponho fazer

Mover a chamada master do bridge para uma Edge Function da Supabase e fazer o backend TanStack chamar essa Edge Function em vez de bater direto no bridge. Resultado: o EasyPanel só precisa das 5 variáveis `VITE_SUPABASE_*` / `SUPABASE_*` (igual ao outro projeto) e nada mais.

### Passos

1. **Criar Edge Function `whatsapp-bridge-proxy`** na Supabase
   - Lê `WHATSHUB_MASTER_TOKEN` dos secrets da Supabase (já existe)
   - Recebe `{ action, payload }` do app
   - Encaminha para `https://vxqvrsaxppbgxookyimz.supabase.co/functions/v1/whatsapp-bridge` com o header `X-Bridge-Token`
   - Devolve a resposta tal como recebeu
   - Protegida por verificação do JWT do usuário (só usuário logado pode usar)

2. **Ajustar `src/lib/whatsapp.server.ts`**
   - Função `bridge(...)` quando `master: true` → chama a Edge Function (não o bridge direto)
   - Quando `apiKey` → continua chamando o bridge direto (não precisa de token mestre)
   - Remover toda a leitura de `process.env.WHATSHUB_MASTER_TOKEN` do código TanStack
   - Remover o parâmetro `masterToken` que eu tinha adicionado no `createInstance`

3. **Remover `WHATSHUB_MASTER_TOKEN` do EasyPanel** (opcional, mas recomendado)
   - Não é mais usado, então é só simplificação

### Resultado

- O EasyPanel fica com as mesmas envs do print do outro projeto.
- Você nunca mais vai precisar mexer em token de WhatsApp no painel do servidor.
- Para trocar o token no futuro, é só atualizar o secret na Supabase.

### Detalhes técnicos

- A Edge Function fica em `supabase/functions/whatsapp-bridge-proxy/index.ts`.
- Ela valida o JWT do chamador via `supabaseAdmin.auth.getUser(token)` antes de encaminhar.
- O TanStack chama com `supabase.functions.invoke('whatsapp-bridge-proxy', { body: { action, payload } })` usando o client autenticado (o JWT do usuário viaja automaticamente).
- Nenhuma alteração de schema/banco. Nenhuma alteração no UI.
