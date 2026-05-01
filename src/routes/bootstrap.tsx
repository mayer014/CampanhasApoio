import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { bootstrapAdmin } from "@/server/admin.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/bootstrap")({
  head: () => ({ meta: [{ title: "Bootstrap Admin" }] }),
  component: BootstrapPage,
});

function BootstrapPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const handlePromote = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
      await bootstrapAdmin({ data: { access_token: session.access_token } });
      setDone(true);
      toast.success("Você agora é admin! Faça logout e login novamente.");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Bootstrap Admin</h1>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Promova o usuário atual ({user.email}) ao papel de <strong>admin</strong>.
          Esta ação só funciona enquanto <em>nenhum admin existir</em> — depois fica
          fechada permanentemente.
        </p>

        {done ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-green-600">✓ Promovido com sucesso!</p>
            <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
              Ir para login
            </Button>
          </div>
        ) : (
          <Button className="mt-6 w-full" onClick={handlePromote} disabled={submitting}>
            {submitting ? "Promovendo..." : "Tornar-me admin"}
          </Button>
        )}
      </Card>
    </div>
  );
}
