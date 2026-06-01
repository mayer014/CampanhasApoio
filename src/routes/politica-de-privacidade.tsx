import { createFileRoute, Link } from "@tanstack/react-router";
import { Shield, Lock, Database, UserX, Mail, FileText } from "lucide-react";

export const Route = createFileRoute("/politica-de-privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Minha Campanha" },
      {
        name: "description",
        content:
          "Política de Privacidade da Minha Campanha: como coletamos, usamos e protegemos seus dados e integrações.",
      },
      { property: "og:title", content: "Política de Privacidade — Minha Campanha" },
      {
        property: "og:description",
        content:
          "Saiba como a Minha Campanha trata dados pessoais, tokens da Meta e inteligência de dados.",
      },
    ],
    links: [
      {
        rel: "canonical",
        href: "https://fotodeapoio.easychain.com.br/politica-de-privacidade",
      },
    ],
  }),
  component: PrivacyPage,
});

const UPDATED_AT = "25 de maio de 2026";

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 flex items-center gap-4">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <Shield className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Política de Privacidade
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Última atualização: {UPDATED_AT}
            </p>
          </div>
        </div>

        <article className="prose prose-neutral max-w-none dark:prose-invert space-y-8 text-[15px] leading-relaxed text-foreground">
          <Section title="1. Introdução">
            <p>
              O <strong>Minha Campanha</strong> ("nós", "nosso" ou "plataforma") é um
              SaaS voltado a candidatos e equipes de campanha que oferece inteligência de
              dados, gestão de militância e automação de redes sociais. Esta Política de
              Privacidade descreve como coletamos, utilizamos, armazenamos e protegemos suas informações.
            </p>
          </Section>

          <Section title="2. Dados que coletamos" icon={<Database className="h-5 w-5" />}>
            <ul className="list-disc space-y-1 pl-6">
              <li>Dados de cadastro: nome, e-mail, telefone e dados públicos do candidato.</li>
              <li>Dados de autenticação fornecidos pela Meta após login (ID do usuário, nome, foto pública).</li>
              <li>Tokens de acesso emitidos pela Meta para Páginas e contas Instagram Business conectadas.</li>
              <li>Métricas públicas de páginas e posts (alcance, impressões, curtidas, comentários).</li>
              <li>Conteúdo de comentários em posts das páginas conectadas, apenas para exibição e análise no painel.</li>
              <li>Dados gerados pelo uso (templates criados, contagens, logs técnicos).</li>
            </ul>
          </Section>

          <Section title="3. Uso de Facebook Login e Instagram Graph API">
            <p>
              O Minha Campanha utiliza <strong>autenticação oficial da Meta</strong>{" "}
              (Facebook Login for Business) e a <strong>Instagram Graph API</strong> para
              permitir conexão de páginas, análise de métricas, leitura de comentários e
              funcionalidades de automação autorizadas pelo usuário.
            </p>
            <p>
              As permissões solicitadas incluem: <code>pages_show_list</code>,{" "}
              <code>pages_read_engagement</code>, <code>pages_read_user_content</code>,{" "}
              <code>pages_manage_engagement</code>, <code>instagram_basic</code>,{" "}
              <code>instagram_manage_comments</code> e{" "}
              <code>instagram_manage_insights</code>. Essas permissões são utilizadas
              estritamente para entregar as funcionalidades contratadas e nunca para
              finalidades não declaradas.
            </p>
          </Section>

          <Section title="4. Armazenamento de tokens de acesso" icon={<Lock className="h-5 w-5" />}>
            <p>
              Tokens de acesso emitidos pela Meta são armazenados de forma criptografada
              em nossa infraestrutura (Supabase), com acesso restrito por políticas de
              Row Level Security (RLS). Apenas o próprio usuário e administradores
              autorizados podem acessar os registros de sua conta. Tokens são utilizados
              exclusivamente para chamadas à Graph API em nome do usuário.
            </p>
          </Section>

          <Section title="5. Comentários, métricas e páginas">
            <p>
              Dados de comentários, métricas e páginas obtidos via Graph API são
              utilizados para exibição no painel do usuário, geração de relatórios,
              classificação de sentimento por IA e respostas a interações — sempre
              dentro do escopo autorizado pelo usuário no momento da conexão.
            </p>
          </Section>

          <Section title="6. Segurança dos dados">
            <p>
              Aplicamos boas práticas de segurança: HTTPS em todas as conexões,
              autenticação via Supabase Auth, isolamento por RLS, segredos protegidos no
              servidor e princípio do menor privilégio. Ainda assim, nenhum sistema é
              100% imune a incidentes — em caso de violação, notificaremos os usuários
              afetados conforme exigido pela LGPD.
            </p>
          </Section>

          <Section title="7. Compartilhamento">
            <p>
              Não vendemos dados pessoais. Compartilhamos informações apenas com
              provedores essenciais à operação do serviço (Supabase, provedor de IA,
              Meta) e quando exigido por lei.
            </p>
          </Section>

          <Section
            title="8. Exclusão de Dados"
            icon={<UserX className="h-5 w-5" />}
          >
            <p>
              O usuário pode solicitar a <strong>remoção total de seus dados</strong> e
              o desligamento de todas as integrações conectadas (Facebook, Instagram,
              WhatsApp) a qualquer momento. Para isso, envie um e-mail para{" "}
              <a href="mailto:suporte@easychain.com.br" className="text-primary underline">
                suporte@easychain.com.br
              </a>{" "}
              com o assunto <em>"Exclusão de Dados"</em>. A remoção é processada em até
              30 dias, incluindo a revogação dos tokens junto à Meta.
            </p>
            <p>
              O usuário também pode revogar o acesso do app diretamente em{" "}
              <a
                href="https://www.facebook.com/settings?tab=business_tools"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline"
              >
                Configurações da Meta › Integrações de Empresa
              </a>
              .
            </p>
          </Section>

          <Section title="9. Direitos do titular (LGPD)">
            <p>
              Você tem direito de confirmar tratamento, acessar, corrigir, anonimizar,
              portar e excluir seus dados, além de revogar consentimentos. Para exercer
              esses direitos, entre em contato pelo e-mail abaixo.
            </p>
          </Section>

          <Section title="10. Contato de suporte" icon={<Mail className="h-5 w-5" />}>
            <p>
              Para dúvidas sobre privacidade, exclusão de dados ou exercício de
              direitos, fale com nosso encarregado:
              <br />
              <strong>E-mail:</strong>{" "}
              <a href="mailto:suporte@easychain.com.br" className="text-primary underline">
                suporte@easychain.com.br
              </a>
            </p>
          </Section>

          <Section title="11. Alterações nesta política">
            <p>
              Podemos atualizar esta Política periodicamente. Mudanças relevantes serão
              comunicadas no painel ou por e-mail. A data de "Última atualização" no
              topo desta página indica a versão vigente.
            </p>
          </Section>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        {icon && <span className="text-primary">{icon}</span>}
        {title}
      </h2>
      <div className="text-muted-foreground [&_strong]:text-foreground [&_a]:text-primary">
        {children}
      </div>
    </section>
  );
}

export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <div className="rounded-md bg-primary/10 p-1.5 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          Minha Campanha
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            to="/politica-de-privacidade"
            className="text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-foreground font-medium" }}
          >
            Privacidade
          </Link>
          <Link
            to="/termos-de-uso"
            className="text-muted-foreground hover:text-foreground"
            activeProps={{ className: "text-foreground font-medium" }}
          >
            Termos
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
        <div className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Minha Campanha · EasyChain. Todos os direitos
          reservados.
        </div>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/politica-de-privacidade" className="text-muted-foreground hover:text-foreground">
            Política de Privacidade
          </Link>
          <Link to="/termos-de-uso" className="text-muted-foreground hover:text-foreground">
            Termos de Uso
          </Link>
          <a
            href="mailto:suporte@easychain.com.br"
            className="text-muted-foreground hover:text-foreground"
          >
            Suporte
          </a>
        </div>
      </div>
    </footer>
  );
}
