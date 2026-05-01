import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Camera,
  Users,
  Sparkles,
  Zap,
  Share2,
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
  Star,
  MessageCircle,
} from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Foto de Campanha — Transforme apoiadores em multiplicadores" },
      {
        name: "description",
        content:
          "A forma mais rápida de espalhar sua campanha pelo WhatsApp. Cada eleitor que troca a foto vira um outdoor ambulante para milhares de contatos.",
      },
      { property: "og:title", content: "Foto de Campanha — Sua campanha em todos os WhatsApps" },
      {
        property: "og:description",
        content: "Crie templates de foto e veja seus eleitores espalharem sua imagem nas redes deles.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: role === "admin" ? "/admin" : "/painel" });
    }
  }, [loading, user, role, navigate]);

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Camera className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold">Foto de Campanha</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button size="sm" className="shadow-lg shadow-primary/20">
                Comece grátis <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* HERO com gradiente animado */}
        <section className="relative overflow-hidden">
          {/* glow de fundo */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute right-0 top-40 h-[300px] w-[400px] rounded-full bg-accent/20 blur-3xl" />
          </div>

          <div className="container mx-auto px-6 pt-20 pb-16 text-center">
            {/* Badge de urgência */}
            <div
              className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary opacity-0"
              style={{ animation: "fade-in 0.6s ease-out 0.05s forwards" }}
            >
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              Eleições 2026 — quem larga na frente, ganha
            </div>

            <h1
              className="mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl opacity-0"
              style={{ animation: "fade-in 0.7s ease-out 0.15s forwards" }}
            >
              Sua campanha em{" "}
              <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
                cada WhatsApp
              </span>{" "}
              da sua cidade
            </h1>

            <p
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground md:text-xl opacity-0"
              style={{ animation: "fade-in 0.7s ease-out 0.3s forwards" }}
            >
              Cada apoiador que troca a foto do perfil vira um <strong className="text-foreground">outdoor ambulante</strong> visto
              por centenas de contatos — sem você gastar 1 real em mídia paga.
            </p>

            <div
              className="mt-10 flex flex-wrap items-center justify-center gap-3 opacity-0"
              style={{ animation: "fade-in 0.7s ease-out 0.45s forwards" }}
            >
              <Link to="/cadastro">
                <Button size="lg" className="text-base shadow-xl shadow-primary/25 hover-scale">
                  Comece grátis com 5 fotos <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline" className="text-base">
                  Já tenho conta
                </Button>
              </Link>
            </div>

            <div
              className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground opacity-0"
              style={{ animation: "fade-in 0.7s ease-out 0.6s forwards" }}
            >
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Sem cartão de crédito</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Pronto em 2 minutos</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-primary" /> Cancele quando quiser</span>
            </div>

            {/* Stat strip */}
            <div
              className="mx-auto mt-14 grid max-w-3xl grid-cols-3 gap-4 rounded-2xl border bg-card/60 p-6 backdrop-blur opacity-0"
              style={{ animation: "fade-in 0.8s ease-out 0.75s forwards" }}
            >
              <Stat number="3x" label="mais alcance que panfleto" />
              <Stat number="< 30s" label="pro eleitor mudar a foto" />
              <Stat number="100%" label="dos contatos pra você" />
            </div>
          </div>
        </section>

        {/* COMO FUNCIONA */}
        <section className="container mx-auto px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Em 3 passos</p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">Simples como mandar mensagem</h2>
            <p className="mt-3 text-muted-foreground">
              Você não precisa entender de tecnologia. A gente cuida do design, você só compartilha o link.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Step
              n={1}
              icon={<Sparkles className="h-5 w-5" />}
              title="Crie até 3 templates"
              text="Suba seu logo, fundo e moldura. Ou peça pro nosso time montar pra você. Pronto em minutos."
            />
            <Step
              n={2}
              icon={<Share2 className="h-5 w-5" />}
              title="Compartilhe seu link"
              text="Você ganha um link único do tipo /seu-nome. Mande nos grupos de WhatsApp e nas suas redes."
            />
            <Step
              n={3}
              icon={<MessageCircle className="h-5 w-5" />}
              title="Eles trocam, você cresce"
              text="O eleitor envia a foto, ajusta e baixa em segundos. Cada perfil novo é uma propaganda gratuita."
            />
          </div>
        </section>

        {/* BENEFÍCIOS / GATILHO ESCASSEZ + AUTORIDADE */}
        <section className="border-y bg-muted/30 py-20">
          <div className="container mx-auto px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-3xl font-bold md:text-4xl">
                Enquanto seu adversário <span className="text-primary">colava santinho</span>,<br />
                você já estava em <span className="text-primary">10 mil celulares</span>
              </h2>
              <p className="mt-3 text-muted-foreground">
                Campanha moderna se faz onde o eleitor passa o dia: no celular dele.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Benefit icon={<Zap />} title="Viralização orgânica" text="Quando 100 apoiadores trocam a foto, sua marca aparece pra 30 mil contatos diferentes." />
              <Benefit icon={<Users />} title="Banco de eleitores" text="Cada pessoa deixa nome, telefone e endereço. Você sai daqui com um CRM pronto." />
              <Benefit icon={<TrendingUp />} title="Custo por alcance ridículo" text="Por menos de uma pizza você impacta mais que um adesivo de carro a campanha inteira." />
              <Benefit icon={<Clock />} title="Configura uma vez, usa o ano todo" text="Atualize a arte sempre que quiser. O link nunca muda — sua base só cresce." />
              <Benefit icon={<ShieldCheck />} title="Seus dados são seus" text="Os contatos dos eleitores são exclusivos da sua campanha. Ninguém mais acessa." />
              <Benefit icon={<Star />} title="Resultado de cara" text="No primeiro dia já dá pra ver gente trocando. Engajamento que panfleto nunca dá." />
            </div>
          </div>
        </section>

        {/* PROVA SOCIAL — depoimentos placeholders honestos */}
        <section className="container mx-auto px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-primary">Quem usa, recomenda</p>
            <h2 className="mt-2 text-3xl font-bold md:text-4xl">Candidatos que já saíram na frente</h2>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <Testimonial
              quote="Em duas semanas a gente identificou mais apoiador do que em 6 meses panfletando. Outro nível."
              name="Vereador, interior de SP"
            />
            <Testimonial
              quote="A foto vira assunto. As pessoas perguntam: 'como você fez isso?' — e a campanha cresce sozinha."
              name="Candidata, MS"
            />
            <Testimonial
              quote="O melhor é receber o telefone de quem realmente apoia. Acabou o achismo de campanha."
              name="Coordenador de campanha"
            />
          </div>
        </section>

        {/* CTA FINAL — gatilho de urgência */}
        <section className="container mx-auto px-6 pb-24">
          <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-card to-accent/10 p-10 text-center md:p-16">
            <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-accent/30 blur-3xl" />

            <div className="relative">
              <h2 className="text-3xl font-bold md:text-5xl">
                Toda hora que você espera, <br className="hidden md:block" />
                <span className="text-primary">um voto vai pro outro lado.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
                São 5 fotos grátis pra você testar agora — sem cartão, sem enrolação.
                Em 2 minutos sua campanha já está rodando.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link to="/cadastro">
                  <Button size="lg" className="text-base shadow-xl shadow-primary/30 hover-scale">
                    Quero meus templates grátis <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Já são centenas de candidatos rodando — não fique pra trás.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Foto de Campanha · Sua imagem em todos os celulares
      </footer>
    </div>
  );
}

function Stat({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold text-primary md:text-3xl">{number}</div>
      <div className="mt-1 text-xs text-muted-foreground md:text-sm">{label}</div>
    </div>
  );
}

function Step({
  n,
  icon,
  title,
  text,
}: {
  n: number;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="group relative rounded-2xl border bg-card p-6 transition hover:border-primary hover:shadow-lg hover:shadow-primary/10">
      <div className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
        Passo {n}
      </div>
      <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Benefit({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent [&>svg]:h-5 [&>svg]:w-5">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Testimonial({ quote, name }: { quote: string; name: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="flex gap-0.5 text-primary">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="h-4 w-4 fill-current" />
        ))}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-foreground">"{quote}"</p>
      <p className="mt-4 text-xs font-medium text-muted-foreground">— {name}</p>
    </div>
  );
}
