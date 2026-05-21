import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Camera, LayoutDashboard, Image as ImageIcon, Users, LogOut, Link2, Menu, MessageCircle, Radar } from "lucide-react";

export const Route = createFileRoute("/painel")({
  component: PainelLayout,
});

function PainelLayout() {
  const { user, role, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const isCandidateRole = role === "candidate" || role === "user";

  useEffect(() => {
    if (loading) return;
    if (!user) navigate({ to: "/login" });
    else if (role === "admin") navigate({ to: "/admin" });
    else if (role === null) navigate({ to: "/bootstrap" });
  }, [loading, user, role, navigate]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (loading || !user || !isCandidateRole) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  const nav = [
    { to: "/painel", label: "Início", icon: LayoutDashboard, exact: true },
    { to: "/painel/templates", label: "Meus templates", icon: ImageIcon },
    { to: "/painel/link", label: "Link público", icon: Link2 },
    { to: "/painel/leads", label: "Eleitores", icon: Users },
    { to: "/painel/whatsapp", label: "WhatsApp", icon: MessageCircle },
    { to: "/painel/social", label: "Inteligência Social", icon: Radar },
  ];

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <>
      {nav.map((item) => {
        const Icon = item.icon;
        const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
              active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "hover:bg-sidebar-accent/50"
            }`}
          >
            <Icon className="h-4 w-4" /> {item.label}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-2 px-6 py-6">
          <Camera className="h-6 w-6 text-sidebar-primary" />
          <span className="font-bold">Foto de Campanha</span>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          <NavLinks />
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <span className="text-sm font-bold">Foto de Campanha</span>
          </div>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button size="icon" variant="ghost" aria-label="Abrir menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
              <div className="flex items-center gap-2 px-6 py-6">
                <Camera className="h-6 w-6 text-sidebar-primary" />
                <span className="font-bold">Foto de Campanha</span>
              </div>
              <nav className="flex-1 space-y-1 px-3">
                <NavLinks onClick={() => setMobileOpen(false)} />
              </nav>
              <div className="border-t border-sidebar-border p-3">
                <Button variant="ghost" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
                  <LogOut className="mr-2 h-4 w-4" /> Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 overflow-auto">
          <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
