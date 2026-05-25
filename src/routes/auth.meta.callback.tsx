import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, AlertTriangle, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth/meta/callback")({
  component: MetaCallbackPage,
});

type Status = "loading" | "success" | "error";

function parseHashParams(hash: string): Record<string, string> {
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  const out: Record<string, string> = {};
  for (const part of h.split("&")) {
    if (!part) continue;
    const [k, v] = part.split("=");
    out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

function MetaCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Conectando sua conta Meta...");

  useEffect(() => {
    (async () => {
      try {
        const hashParams = parseHashParams(window.location.hash || "");
        const queryParams = new URLSearchParams(window.location.search);

        // Meta error
        const err = hashParams.error || queryParams.get("error");
        if (err) {
          throw new Error(
            hashParams.error_description ||
              queryParams.get("error_description") ||
              "Autorização negada pela Meta.",
          );
        }

        const accessToken = hashParams.access_token;
        if (!accessToken) {
          throw new Error("Token de acesso não retornado pela Meta.");
        }

        const expiresInSec = Number(hashParams.expires_in || "0");
        const expiresAt =
          expiresInSec > 0
            ? new Date(Date.now() + expiresInSec * 1000).toISOString()
            : null;

        const { data: sess } = await supabase.auth.getUser();
        const user = sess.user;
        if (!user) throw new Error("Você precisa estar autenticado.");

        // Upsert no social_connections (unique por user_id + platform)
        const { error: upErr } = await supabase
          .from("social_connections")
          .upsert(
            {
              user_id: user.id,
              platform: "meta",
              access_token: accessToken,
              expires_at: expiresAt,
              status: "connected",
              metadata: { source: "implicit_oauth", granted_at: new Date().toISOString() },
            },
            { onConflict: "user_id,platform" },
          );

        if (upErr) throw new Error(upErr.message);

        setStatus("success");
        setMessage("Facebook conectado com sucesso!");

        // limpa o hash da URL
        window.history.replaceState(null, "", window.location.pathname);

        setTimeout(() => {
          navigate({ to: "/painel/redes-sociais" });
        }, 1400);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Falha ao conectar.");
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <div className="flex -space-x-2">
            <div className="rounded-full bg-[#1877F2] p-3 ring-4 ring-background">
              <Facebook className="h-6 w-6 text-white" />
            </div>
            <div className="rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-3 ring-4 ring-background">
              <Instagram className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>

        {status === "loading" && (
          <div className="text-center space-y-3">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <h1 className="text-lg font-semibold">{message}</h1>
            <p className="text-sm text-muted-foreground">Estamos validando seu acesso com segurança.</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="text-lg font-semibold">{message}</h1>
            <p className="text-sm text-muted-foreground">Redirecionando ao painel...</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-center space-y-4">
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
            <h1 className="text-lg font-semibold">Não foi possível conectar</h1>
            <p className="text-sm text-muted-foreground break-words">{message}</p>
            <Button onClick={() => navigate({ to: "/painel/redes-sociais" })} className="w-full">
              Voltar para Redes Sociais
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
