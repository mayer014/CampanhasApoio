import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Camera, Users, Sparkles } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Foto de Campanha — Templates de perfil para WhatsApp" },
      { name: "description", content: "Crie fotos de perfil personalizadas para sua campanha eleitoral. Engaje seus eleitores com fotos no estilo da campanha." },
      { property: "og:title", content: "Foto de Campanha" },
      { property: "og:description", content: "Templates de foto de perfil para campanhas eleitorais." },
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
      <header className="border-b">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold">Foto de Campanha</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button>Cadastre-se grátis</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="container mx-auto px-6 py-24 text-center">
          <h1 className="mx-auto max-w-3xl text-5xl font-bold tracking-tight md:text-6xl">
            Engaje seus eleitores com a <span className="text-primary">foto da sua campanha</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
            Plataforma para candidatos criarem templates de foto de perfil. Compartilhe um link e
            seus apoiadores trocam a foto do WhatsApp em segundos — você ainda recebe os contatos.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link to="/cadastro">
              <Button size="lg" className="text-base">Comece grátis com 5 fotos</Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline" className="text-base">Já tenho conta</Button>
            </Link>
          </div>
        </section>

        <section className="container mx-auto grid gap-6 px-6 pb-24 md:grid-cols-3">
          <div className="rounded-2xl border bg-card p-8">
            <Sparkles className="h-8 w-8 text-accent" />
            <h3 className="mt-4 text-lg font-semibold">Templates prontos</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Receba seus templates configurados sob medida e ative o que quiser usar a qualquer momento.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-8">
            <Users className="h-8 w-8 text-accent" />
            <h3 className="mt-4 text-lg font-semibold">Link único de campanha</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Compartilhe um link com seus eleitores. Eles enviam a foto, ajustam e baixam pronta.
            </p>
          </div>
          <div className="rounded-2xl border bg-card p-8">
            <Camera className="h-8 w-8 text-accent" />
            <h3 className="mt-4 text-lg font-semibold">Banco de eleitores</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Cada apoiador deixa nome, telefone e endereço — você gera contato qualificado de campanha.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Foto de Campanha
      </footer>
    </div>
  );
}
