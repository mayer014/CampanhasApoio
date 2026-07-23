import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { completeSocialConnect } from "@/lib/socialapi-connect.functions";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/auth/socialapi/callback")({
  component: SocialApiCallbackPage,
  head: () => ({
    meta: [
      { title: "Conectando conta social — Foto de Apoio" },
      { name: "description", content: "Finalizando a conexão da sua rede social." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
});

function SocialApiCallbackPage() {
  const navigate = useNavigate();
  const complete = useServerFn(completeSocialConnect);
  const [state, setState] = useState<{ kind: "loading" | "ok" | "error"; message?: string }>({
    kind: "loading",
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code") ?? "";
    const st = params.get("state") ?? "";
    const err = params.get("error") ?? params.get("error_description");

    if (err) {
      setState({ kind: "error", message: err });
      return;
    }
    if (!code || !st) {
      setState({ kind: "error", message: "Parâmetros ausentes no retorno." });
      return;
    }

    void complete({ data: { code, state: st } })
      .then(() => {
        setState({ kind: "ok" });
        setTimeout(() => navigate({ to: "/painel/redes-sociais" }), 900);
      })
      .catch((e) => {
        setState({ kind: "error", message: e instanceof Error ? e.message : "Falha ao concluir." });
      });
  }, [complete, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
        {state.kind === "loading" && (
          <>
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <h1 className="mt-4 text-lg font-semibold">Conectando sua conta…</h1>
            <p className="mt-1 text-sm text-muted-foreground">Aguarde só um instante.</p>
          </>
        )}
        {state.kind === "ok" && (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
            <h1 className="mt-4 text-lg font-semibold">Conta conectada!</h1>
            <p className="mt-1 text-sm text-muted-foreground">Redirecionando para o painel…</p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <AlertTriangle className="mx-auto h-10 w-10 text-destructive" />
            <h1 className="mt-4 text-lg font-semibold">Não deu para concluir</h1>
            <p className="mt-1 text-sm text-muted-foreground">{state.message}</p>
            <button
              className="mt-4 text-sm font-medium text-primary underline"
              onClick={() => navigate({ to: "/painel/redes-sociais" })}
            >
              Voltar para o painel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
