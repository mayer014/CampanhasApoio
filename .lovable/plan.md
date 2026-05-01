# Plano: Sistema de Templates para Foto de Perfil de Campanha

## Visão Geral
Plataforma com 3 tipos de uso:
1. **Super Admin (você)** — gerencia candidatos, monta templates, controla pagamentos no mini-CRM.
2. **Candidato** — entra no painel, escolhe qual template fica ativo no link público, copia o link e envia para os eleitores. Vê estatísticas de uso.
3. **Eleitor (público, sem login)** — abre o link, preenche dados de contato, envia foto, ajusta enquadramento e baixa o PNG 1080x1080 final.

## Papéis e Acessos

**Super Admin**
- Cria/edita/bloqueia candidatos (define login + senha inicial)
- Monta templates: faz upload das 4 camadas decorativas (background, círculo base, elemento, logo) e configura posição X/Y e zoom de cada uma sobre o canvas 1080x1080
- Define qual é o "buraco" da foto (posição X/Y, tamanho do círculo onde a foto do eleitor entra)
- Vê todos os candidatos, todos os leads de eleitores, todas as estatísticas
- Mini-CRM: status (ativo/bloqueado), histórico de pagamentos, valores, observações, lembretes de vencimento

**Candidato**
- Login com email + senha
- Vê seus templates configurados pelo admin
- Escolhe **um template ativo** que vai aparecer no link público (pode trocar quando quiser)
- Copia link único: `/p/{slug-do-candidato}`
- Vê contador de fotos geradas por template
- Vê lista/exporta os leads coletados (nome, telefone, endereço completo)
- Vê status da própria assinatura (vencimento)

**Eleitor (link público)**
- Abre o link, vê preview do template ativo
- Preenche formulário: nome, telefone, rua, número, bairro (obrigatórios)
- Faz upload da foto, arrasta/dá zoom para posicionar dentro do círculo
- Clica gerar e baixa o PNG 1080x1080
- Sem login, sem cota, sem rate limit

## Estrutura de Templates

Cada template tem 5 camadas empilhadas (de baixo para cima), todas configuráveis com posição X/Y e zoom:

```text
Camada 5: Logo                    (PNG configurado pelo admin)
Camada 4: Elemento                (PNG configurado pelo admin)
Camada 3: FOTO DO ELEITOR         (vai dentro de um círculo definido)
Camada 2: Círculo base            (PNG configurado pelo admin)
Camada 1: Background 1080x1080    (PNG configurado pelo admin)
```

A composição final é renderizada em canvas no navegador do eleitor e baixada como PNG quadrado.

## Detalhes Técnicos

- **Stack**: TanStack Start + Tailwind + Supabase (externo)
- **Auth**: Email + senha + Google para admin/candidato. Sem auth para eleitor (link público).
- **Backend**: Server functions do TanStack Start (`createServerFn`) usando `supabaseAdmin` para operações privilegiadas (criação de candidato, bootstrap admin)
- **Banco** (Supabase com RLS):
  - `candidate_profiles`, `user_roles`, `templates`, `voter_leads`, `payments`, `subscriptions`
- **Storage**: bucket público `template-layers` (write apenas admin, read público por arquivo)
- **Editor de imagem**: canvas HTML5 nativo, exporta PNG via `canvas.toBlob`

## Fora do Escopo (v1)

- Pagamento online / checkout (gerenciado manualmente)
- Cobrança recorrente automática
- Notificações por email/SMS
- Edição das camadas decorativas pelo candidato
- Armazenamento das fotos geradas
