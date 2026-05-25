import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectMetaAccountWithState } from "@/lib/meta-connect.functions";

export const Route = createFileRoute("/auth/meta/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description:
      typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  loader: async ({ search }) => {
    const err = search.error_description || search.error;
    if (err) throw new Error(err);
    if (!search.code) throw new Error("Código de autorização não retornado pela Meta.");
    if (!search.state) throw new Error("Parâmetro state ausente. Reinicie a conexão.");

    const result = await connectMetaAccountWithState({
      data: {
        code: search.code,
        state: search.state,
      },
    });

    if (!result?.page_id) {
      throw new Error(
        "Nenhuma página do Facebook encontrada. Verifique se sua conta administra uma página.",
      );
    }

    return result;
  },
  component: MetaCallbackSuccessPage,
  errorComponent: MetaCallbackErrorPage,
  notFoundComponent: MetaCallbackNotFoundPage,
});

function MetaCallbackSuccessPage() {
  const navigate = useNavigate();
  const result = Route.useLoaderData();

  useEffect(() => {
    window.history.replaceState(null, "", window.location.pathname);

    if (window.opener && !window.opener.closed) {
      try {
        window.opener.postMessage({ type: "meta-oauth-success" }, window.location.origin);
      } catch {
        /* noop */
      }
      const timer = window.setTimeout(() => window.close(), 800);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => navigate({ to: "/painel/redes-sociais" }), 1200);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <MetaCallbackCard>
      <div className="text-center space-y-3">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
        <h1 className="text-lg font-semibold">Facebook conectado com sucesso!</h1>
        <p className="text-sm text-muted-foreground">
          {result.page_name ? `Página conectada: ${result.page_name}.` : "Sua conexão foi salva com sucesso."}
        </p>
        <p className="text-sm text-muted-foreground">Você pode fechar esta janela.</p>
      </div>
    </MetaCallbackCard>
  );
}

function MetaCallbackErrorPage({ error }: { error: Error }) {
  const navigate = useNavigate();

  return (
    <MetaCallbackCard>
      <div className="text-center space-y-4">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
        <h1 className="text-lg font-semibold">Não foi possível conectar</h1>
        <p className="text-sm text-muted-foreground break-words">{error.message || "Falha ao conectar."}</p>
        <Button onClick={() => navigate({ to: "/painel/redes-sociais" })} className="w-full">
          Voltar para Redes Sociais
        </Button>
      </div>
    </MetaCallbackCard>
  );
}

function MetaCallbackNotFoundPage() {
  return (
    <MetaCallbackCard>
      <div className="text-center space-y-4">
        <Loader2 className="mx-auto h-8 w-8 text-primary" />
        <h1 className="text-lg font-semibold">Callback Meta indisponível</h1>
        <p className="text-sm text-muted-foreground">
          Abra a conexão novamente pela página de Redes Sociais.
        </p>
      </div>
    </MetaCallbackCard>
  );
}

function MetaCallbackCard({ children }: { children: React.ReactNode }) {
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
        {children}
      </div>
    </div>
  );
}
