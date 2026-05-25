import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CheckCircle2, AlertTriangle, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectMetaAccountWithState } from "@/lib/meta-connect.functions";

export const Route = createFileRoute("/auth/meta/callback")({
  component: MetaCallbackPage,
});

type Status = "loading" | "success" | "error";

function MetaCallbackPage() {
  const navigate = useNavigate();
  const connect = useServerFn(connectMetaAccountWithState);
  const [status, setStatus] = useState<Status>("loading");
  const [message, setMessage] = useState("Conectando sua conta Meta...");

  useEffect(() => {
    (async () => {
      try {
        const query = new URLSearchParams(window.location.search);
        const err = query.get("error_description") || query.get("error");
        if (err) throw new Error(err);

        const code = query.get("code");
        if (!code) throw new Error("Código de autorização não retornado pela Meta.");

        const result = await connect({ data: { code } });
        if (!result?.page_id) {
          throw new Error(
            "Nenhuma página do Facebook encontrada. Verifique se sua conta administra uma página.",
          );
        }

        setStatus("success");
        setMessage("Facebook conectado com sucesso!");
        window.history.replaceState(null, "", window.location.pathname);

        // Se aberto como popup, notificar e fechar
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: "meta-oauth-success" }, window.location.origin);
          } catch {
            /* noop */
          }
          setTimeout(() => window.close(), 800);
          return;
        }

        setTimeout(() => navigate({ to: "/painel/redes-sociais" }), 1200);
      } catch (e) {
        setStatus("error");
        setMessage(e instanceof Error ? e.message : "Falha ao conectar.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            <p className="text-sm text-muted-foreground">
              Trocando token, buscando sua página e Instagram...
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="text-lg font-semibold">{message}</h1>
            <p className="text-sm text-muted-foreground">Você pode fechar esta janela.</p>
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
