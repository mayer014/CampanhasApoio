# Plano para corrigir o fluxo de conexão Meta

## Objetivo
Fazer a conexão com Facebook/Instagram só ser considerada concluída quando a conta tiver sido realmente gravada no banco, evitando que a tela volte para “Conectar” após parecer que deu certo.

## O que vou implementar
1. Revisar o server function `connectMetaAccount` para remover a dependência frágil no client admin em módulo compartilhado e tornar o salvamento da conexão mais robusto no runtime da VPS.
2. Ajustar o fluxo da tela `/painel/redes-sociais` para não tratar o retorno do popup como sucesso visual antes da gravação no banco ser confirmada.
3. Melhorar a recarga do estado da conexão para distinguir claramente:
   - não conectado
   - conectando/salvando
   - erro ao salvar
   - conectado de fato
4. Adicionar diagnóstico objetivo no fluxo para diferenciar:
   - falha por variável ausente no servidor
   - falha ao gravar na tabela `social_connections`
   - falha de leitura por autenticação/RLS
5. Validar se a tela usa a linha gravada corretamente para exibir o painel de gerenciamento, sem voltar prematuramente para o CTA de conexão.

## Resultado esperado
- Ao conectar, a UI permanece em estado de processamento até o registro existir no banco.
- Se o servidor não conseguir salvar, o usuário vê erro claro e a conexão não é mostrada como concluída.
- Quando a linha existir em `social_connections`, a tela exibe o modo de gerenciamento normalmente.

## Detalhes técnicos
- O snapshot atual mostra que as consultas do navegador para `social_connections` retornam array vazio para o usuário autenticado.
- O console mostra falha no `connectMetaAccount`: `Missing Supabase environment variable: SUPABASE_SERVICE_ROLE_KEY`.
- A tabela `social_connections` tem políticas de acesso para o dono da linha, então o problema principal neste momento não parece ser RLS da leitura, e sim a ausência da gravação.
- Vou concentrar a correção nos arquivos do fluxo Meta: server function, helper de persistência e tela `painel.redes-sociais`.