# Plano para corrigir o módulo de Inteligência Social

Identifiquei um problema estrutural novo e concreto: as tabelas sociais existem, o RLS existe, mas **não há permissões de tabela concedidas ao papel `authenticated`** para `social_profiles`, `social_alerts` e `social_jobs`. Na prática, o usuário autentica normalmente, passa pelo middleware, mas o Postgres barra as queries antes mesmo do RLS funcionar. Isso explica o comportamento oscilante: o app mostra erro genérico, banner de configuração e falhas ao listar/criar perfis.

## O que vou fazer

### 1. Corrigir permissões do banco
Criar uma migration para:
- conceder acesso adequado a `authenticated` nas tabelas sociais usadas pelo painel
- conceder acesso adequado a `service_role` para filas e ingestão
- revisar permissões mínimas de funções sociais usadas pelo painel e pelo crawler
- garantir que a correção siga o RLS existente, sem abrir dados de outros usuários

### 2. Auditar e fechar o modelo de acesso
Revisar a combinação de:
- GRANTs de tabela
- políticas RLS
- funções `SECURITY DEFINER`
- uso de `supabase` autenticado vs `supabaseAdmin`

Objetivo:
- candidato só enxerga e altera os próprios perfis/alertas
- admin mantém acesso total
- crawler/fila continua operando com privilégio elevado no servidor

### 3. Simplificar o diagnóstico do backend
Ajustar o módulo social para:
- distinguir claramente erro de permissão, erro de sessão e erro de schema
- parar de tratar “falta de permissão” como se fosse “SUPABASE_URL ausente”
- devolver mensagens úteis no painel, sem mascarar a causa real

### 4. Endurecer o fluxo do painel social
Revisar a rota e os painéis para:
- evitar polling ou chamadas prematuras quando a sessão ainda não hidratou
- evitar estados que repetem erro indefinidamente
- manter carregamento estável depois do login e depois do cadastro

### 5. Validar ponta a ponta
Depois da implementação, vou validar estes cenários:
- login de candidato existente
- abertura da aba Inteligência Social
- listagem de perfis sem erro
- cadastro de perfil Instagram
- atualização e remoção de perfil
- leitura de alertas
- operação do dashboard sem cair em erro genérico

## Resultado esperado
Depois dessa correção, o módulo deve:
- abrir sem o banner falso de “configuração incompleta”
- cadastrar perfis normalmente
- listar alertas e operação sem erro interno
- depender de regras estáveis de banco, não de soluções paliativas no frontend

## Detalhes técnicos
- Evidência encontrada: consultas em `information_schema.role_table_grants` retornaram **nenhum GRANT** para as tabelas sociais principais.
- As políticas RLS de `social_profiles` e `social_alerts` existem e estão coerentes.
- A função `social_dashboard_stats()` existe e possui `EXECUTE`, então o gargalo principal atual está no acesso às tabelas.
- O problema não parece ser ausência das tabelas nem falta de role do usuário; há usuários com `candidate` cadastrados.

Se você aprovar, eu executo essa correção atacando banco + backend juntos, porque agora temos uma causa raiz bem mais provável do que as tentativas anteriores.