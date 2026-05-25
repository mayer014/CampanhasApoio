import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { PublicHeader, PublicFooter } from "./politica-de-privacidade";

export const Route = createFileRoute("/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Foto de Campanha" },
      {
        name: "description",
        content:
          "Termos de Uso do Foto de Campanha: regras de uso da plataforma, integrações com Meta e responsabilidades do usuário.",
      },
      { property: "og:title", content: "Termos de Uso — Foto de Campanha" },
      {
        property: "og:description",
        content: "Leia os Termos de Serviço do Foto de Campanha.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://fotodeapoio.easychain.com.br/termos-de-uso" },
    ],
  }),
  component: TermsPage,
});

const UPDATED_AT = "25 de maio de 2026";

function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-10 flex items-center gap-4">
          <div className="rounded-xl bg-primary/10 p-3 text-primary">
            <ScrollText className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Termos de Uso
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Última atualização: {UPDATED_AT}
            </p>
          </div>
        </div>

        <article className="space-y-8 text-[15px] leading-relaxed text-foreground">
          <Section title="1. Aceitação dos termos">
            <p>
              Ao acessar ou utilizar o <strong>Foto de Campanha</strong> ("plataforma"),
              você concorda com estes Termos de Uso e com nossa{" "}
              <a href="/politica-de-privacidade" className="text-primary underline">
                Política de Privacidade
              </a>
              . Se você não concordar, não utilize o serviço.
            </p>
          </Section>

          <Section title="2. Descrição do serviço">
            <p>
              O Foto de Campanha é uma plataforma SaaS que permite criar fotos de perfil
              personalizadas, engajar apoiadores via WhatsApp e conectar contas
              oficiais de Facebook e Instagram para análise de métricas, leitura de
              comentários e automações autorizadas.
            </p>
          </Section>

          <Section title="3. Cadastro e conta">
            <p>
              Você é responsável pela veracidade das informações fornecidas, pela
              guarda das suas credenciais e por toda atividade realizada em sua conta.
              Notifique-nos imediatamente em caso de uso não autorizado.
            </p>
          </Section>

          <Section title="4. Integrações com a Meta">
            <p>
              Ao conectar suas contas via Facebook Login for Business e Instagram Graph
              API, você autoriza o Foto de Campanha a acessar dados das páginas e
              contas Instagram Business indicadas, no escopo das permissões aprovadas.
              Você pode revogar o acesso a qualquer momento nas configurações da Meta
              ou solicitando exclusão pelo nosso suporte.
            </p>
          </Section>

          <Section title="5. Uso aceitável">
            <p>É proibido utilizar a plataforma para:</p>
            <ul className="list-disc space-y-1 pl-6 text-muted-foreground">
              <li>Disseminar desinformação, discurso de ódio ou conteúdo ilegal.</li>
              <li>Violar políticas da Meta, do WhatsApp ou de qualquer terceiro.</li>
              <li>Spam, automações abusivas ou contato não autorizado.</li>
              <li>Tentar acessar dados de outros usuários ou comprometer a segurança do serviço.</li>
            </ul>
          </Section>

          <Section title="6. Propriedade intelectual">
            <p>
              Todo o software, marca, layout e conteúdo da plataforma são de
              propriedade do Foto de Campanha / EasyChain. O conteúdo que você cria
              continua sendo seu, e você nos concede licença para hospedá-lo e exibi-lo
              conforme necessário para prestar o serviço.
            </p>
          </Section>

          <Section title="7. Planos, pagamentos e cancelamento">
            <p>
              Planos, limites de uso e condições comerciais são informados no momento
              da contratação. Você pode cancelar a qualquer momento; valores já pagos
              referentes ao período em curso não são reembolsáveis, salvo disposição
              legal em contrário.
            </p>
          </Section>

          <Section title="8. Limitação de responsabilidade">
            <p>
              O serviço é fornecido "no estado em que se encontra". Na máxima extensão
              permitida pela lei, não nos responsabilizamos por danos indiretos,
              lucros cessantes ou perda de dados decorrentes do uso da plataforma ou
              de indisponibilidades de serviços de terceiros (incluindo Meta, WhatsApp
              e provedores de infraestrutura).
            </p>
          </Section>

          <Section title="9. Suspensão e encerramento">
            <p>
              Podemos suspender ou encerrar contas que violem estes Termos, políticas
              da Meta ou a legislação aplicável, com ou sem aviso prévio quando
              necessário para proteger a plataforma e seus usuários.
            </p>
          </Section>

          <Section title="10. Alterações">
            <p>
              Podemos atualizar estes Termos periodicamente. O uso contínuo após a
              publicação de uma nova versão constitui aceitação das alterações.
            </p>
          </Section>

          <Section title="11. Legislação e foro">
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil.
              Fica eleito o foro do domicílio do usuário consumidor para dirimir
              quaisquer controvérsias.
            </p>
          </Section>

          <Section title="12. Contato">
            <p>
              Dúvidas sobre estes Termos:{" "}
              <a href="mailto:suporte@easychain.com.br" className="text-primary underline">
                suporte@easychain.com.br
              </a>
              .
            </p>
          </Section>
        </article>
      </main>

      <PublicFooter />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </section>
  );
}
