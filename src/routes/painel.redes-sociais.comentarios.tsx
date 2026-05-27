import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { CommentsInbox } from "@/components/social/CommentsInbox";
import { Button } from "@/components/ui/button";
import { ArrowLeft, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/painel/redes-sociais/comentarios")({
  component: ComentariosPage,
});

function ComentariosPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<"loading" | "ok" | "missing">("loading");

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("social_connections")
      .select("status")
      .eq("user_id", user.id)
      .eq("platform", "meta")
      .maybeSingle()
      .then(({ data }) => {
        setStatus(data?.status === "connected" ? "ok" : "missing");
      });
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/painel/redes-sociais"><ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Central de Comentários</h1>
          <p className="text-sm text-muted-foreground">Responda, oculte ou marque como tratado.</p>
        </div>
      </div>

      {status === "loading" ? (
        <div className="text-sm text-muted-foreground">Carregando…</div>
      ) : status === "missing" ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-500" />
          <div>
            <p className="font-medium">Conecte sua conta Meta primeiro</p>
            <Button asChild size="sm" className="mt-2">
              <Link to="/painel/redes-sociais">Ir para conexão</Link>
            </Button>
          </div>
        </div>
      ) : (
        <CommentsInbox />
      )}
    </div>
  );
}
