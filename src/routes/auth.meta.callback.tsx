import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectMetaAccount } from "@/lib/meta-connect.functions";
import { META_OAUTH_STATE_STORAGE_KEY } from "@/lib/meta-oauth";

type MetaDiag = {
  message: string;
  token_debug: {
    is_valid: boolean;
    app_id: string | null;
    user_id: string | null;
    scopes: string[];
    granular_scopes: Array<{ scope?: string; target_ids?: string[]; expired_time?: number }>;
    data_access_expires_at: number | null;
  };
  me_accounts_raw: unknown;
};

type CallbackStatus =
  | { kind: "loading" }
  | { kind: "success"; pageName: string | null }
  | { kind: "error"; message: string; diag?: MetaDiag };

export const Route = createFileRoute("/auth/meta/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    code: typeof search.code === "string" ? search.code : undefined,
    state: typeof search.state === "string" ? search.state : undefined,
    error: typeof search.error === "string" ? search.error : undefined,
    error_description:
      typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  component: MetaCallbackPage,
});

function MetaCallbackPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [status, setStatus] = useState<CallbackStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const err = search.error_description || search.error;
        if (err) throw new Error(err);
        if (!search.code) throw new Error("Código de autorização não retornado pela Meta.");

        // Validação client-side do state via localStorage
        const expectedState = localStorage.getItem(META_OAUTH_STATE_STORAGE_KEY);
        if (!expectedState) {
          throw new Error(
            "State OAuth não encontrado. Reabra a conexão a partir da página Redes Sociais.",
          );
        }
        if (!search.state || search.state !== expectedState) {
          throw new Error("State OAuth inválido. Por segurança, reinicie a conexão.");
        }
        // Consome o state (one-time use)
        localStorage.removeItem(META_OAUTH_STATE_STORAGE_KEY);

        const result = await connectMetaAccount({ data: { code: search.code } });
        if (!result?.page_id) {
          throw new Error(
            "Nenhuma página do Facebook encontrada. Verifique se sua conta administra uma página.",
          );
        }

        if (cancelled) return;
        setStatus({ kind: "success", pageName: result.page_name ?? null });

        window.history.replaceState(null, "", window.location.pathname);

        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage({ type: "meta-oauth-success" }, window.location.origin);
          } catch { /* noop */ }
          window.setTimeout(() => window.close(), 800);
        } else {
          window.setTimeout(() => navigate({ to: "/painel/redes-sociais" }), 1200);
        }
      } catch (e) {
        if (cancelled) return;
        const raw = e instanceof Error ? e.message : "Falha ao conectar com a Meta.";
        let diag: MetaDiag | undefined;
        let message = raw;
        const idx = raw.indexOf("META_DIAG:");
        if (idx >= 0) {
          try {
            diag = JSON.parse(raw.slice(idx + "META_DIAG:".length)) as MetaDiag;
            message = diag.message;
            console.error("[meta-oauth] diagnóstico", diag);
          } catch {
            /* keep raw */
          }
        }
        setStatus({ kind: "error", message, diag });
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [search.code, search.state, search.error, search.error_description, navigate]);

  if (status.kind === "loading") {
    return (
      <MetaCallbackCard>
        <div className="text-center space-y-3">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <h1 className="text-lg font-semibold">Conectando sua conta Meta…</h1>
          <p className="text-sm text-muted-foreground">Validando autorização e carregando páginas.</p>
        </div>
      </MetaCallbackCard>
    );
  }

  if (status.kind === "success") {
    return (
      <MetaCallbackCard>
        <div className="text-center space-y-3">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
          <h1 className="text-lg font-semibold">Facebook conectado com sucesso!</h1>
          <p className="text-sm text-muted-foreground">
            {status.pageName ? `Página conectada: ${status.pageName}.` : "Sua conexão foi salva."}
          </p>
          <p className="text-sm text-muted-foreground">Você pode fechar esta janela.</p>
        </div>
      </MetaCallbackCard>
    );
  }

  return (
    <MetaCallbackCard>
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="text-lg font-semibold">Não foi possível conectar</h1>
          <p className="text-sm text-muted-foreground break-words">{status.message}</p>
        </div>
        {status.diag && (
          <div className="space-y-3 text-xs">
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="font-semibold mb-1">Token debug</div>
              <ul className="space-y-0.5 font-mono">
                <li>is_valid: {String(status.diag.token_debug.is_valid)}</li>
                <li>app_id: {status.diag.token_debug.app_id ?? "—"}</li>
                <li>user_id: {status.diag.token_debug.user_id ?? "—"}</li>
                <li>data_access_expires_at: {status.diag.token_debug.data_access_expires_at ?? "—"}</li>
              </ul>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="font-semibold mb-1">Scopes concedidos</div>
              <div className="font-mono break-words">
                {status.diag.token_debug.scopes.length
                  ? status.diag.token_debug.scopes.join(", ")
                  : "(nenhum)"}
              </div>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="font-semibold mb-1">Granular scopes</div>
              <pre className="font-mono whitespace-pre-wrap break-words max-h-40 overflow-auto">
{JSON.stringify(status.diag.token_debug.granular_scopes, null, 2)}
              </pre>
            </div>
            <div className="rounded-md border bg-muted/40 p-3">
              <div className="font-semibold mb-1">Resposta bruta de /me/accounts</div>
              <pre className="font-mono whitespace-pre-wrap break-words max-h-48 overflow-auto">
{JSON.stringify(status.diag.me_accounts_raw, null, 2)}
              </pre>
            </div>
          </div>
        )}
        <Button onClick={() => navigate({ to: "/painel/redes-sociais" })} className="w-full">
          Voltar para Redes Sociais
        </Button>
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
