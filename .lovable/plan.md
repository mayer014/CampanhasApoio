## Objetivo
Permitir que o super admin altere a senha de qualquer candidato direto pelo painel, útil quando o usuário esquece a senha.

## Onde aparece na UI
Na página de detalhes do candidato (`/admin/candidatos/$id`), adicionar um card **"Segurança"** com:
- Botão **"Alterar senha"** → abre um Dialog
- Dialog com 2 campos: nova senha + confirmar senha (mín. 8 caracteres)
- Botão "Salvar" → chama o server function

## Backend
Criar nova server function `adminResetCandidatePassword` em `src/server/admin.functions.ts`:
- Protegida com `requireSupabaseAuth`
- Valida que o caller é admin (mesma checagem já usada em `adminCreateCandidate`)
- Valida input com Zod: `{ user_id: uuid, new_password: string min 8 max 128 }`
- Chama `supabaseAdmin.auth.admin.updateUserById(user_id, { password })`
- Retorna `{ success: true }`

## Segurança
- Apenas admin pode chamar (dupla checagem: middleware + verificação de role)
- Senha nunca trafega em logs
- Usa service role key apenas no servidor (já existe em `client.server.ts`)
- Não toca em sessões ativas do usuário (Supabase invalida automaticamente nas próximas requisições se desejado, mas o padrão atual é manter sessões — comportamento ok pra esse caso)

## Detalhes técnicos
- **Arquivo novo/alterado**: `src/server/admin.functions.ts` (adicionar função)
- **Arquivo alterado**: `src/routes/admin.candidatos.$id.index.tsx` (adicionar card + dialog)
- **UI**: usa componentes shadcn já existentes (`Dialog`, `Input`, `Button`, `Label`)
- **Toast** de sucesso/erro via `sonner` (já usado no projeto)
- Não precisa de mudança no banco nem nas Edge Functions

## Fora do escopo
- Não envia email avisando o usuário que a senha foi alterada
- Não força logout das sessões ativas do usuário
- Não cria histórico/auditoria de troca de senha (pode ser adicionado depois se quiser)
