import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, AlertTriangle, Facebook, Instagram } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { connectMetaAccountWithState } from "@/lib/meta-connect.functions";

type StateDiag = {
  state_received: string;
  found: boolean;
  reason?: string;
  used_at?: string;
  expires_at?: string;
};


type MetaDiag = {
  message: string;
  short_token?: { fingerprint: string; expires_in: number };
  long_token?: {
    fingerprint: string;
    expires_in: number;
    long_lived_attempted: boolean;
    long_lived_error: string | null;
  };
  debug_token_short?: unknown;
  debug_token_long?: unknown;
  me_accounts?: {
    request_url: string;
    status: number;
    headers: Record<string, string>;
    body: unknown;
    pages_count: number;
  };
};

type CallbackStatus =
  | { kind: "loading" }
  | { kind: "success"; pageName: string | null }
  | { kind: "error"; message: string; diag?: MetaDiag; stateDiag?: StateDiag };

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
  const connectFn = useServerFn(connectMetaAccountWithState);
  const [status, setStatus] = useState<CallbackStatus>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const err = search.error_description || search.error;
        if (err) throw new Error(err);
        if (!search.code) throw new Error("Código de autorização não retornado pela Meta.");
        if (!search.state) throw new Error("Parâmetro state ausente no retorno da Meta.");

        const result = await connectFn({ data: { code: search.code, state: search.state } });
        if (!result?.page_id) {
          throw new Error("Nenhuma página do Facebook foi encontrada para esta conta.");
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
        let stateDiag: StateDiag | undefined;
        let message = raw;
        const metaIdx = raw.indexOf("META_DIAG:");
        const stateIdx = raw.indexOf("STATE_DIAG:");
        if (metaIdx >= 0) {
          try {
            diag = JSON.parse(raw.slice(metaIdx + "META_DIAG:".length)) as MetaDiag;
            message = diag.message;
            console.error("[meta-oauth] diagnóstico completo", diag);
          } catch { /* keep raw */ }
        } else if (stateIdx >= 0) {
          try {
            stateDiag = JSON.parse(raw.slice(stateIdx + "STATE_DIAG:".length)) as StateDiag;
            message = `State OAuth inválido: ${stateDiag.reason ?? "motivo desconhecido"}`;
            console.error("[meta-oauth] state diag", stateDiag);
          } catch { /* keep raw */ }
        }
        setStatus({ kind: "error", message, diag, stateDiag });
      }
    }
    void run();
    return () => { cancelled = true; };
  }, [search.code, search.state, search.error, search.error_description, navigate, connectFn]);

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
    <MetaCallbackCard wide>
      <div className="space-y-4">
        <div className="text-center space-y-2">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" />
          <h1 className="text-lg font-semibold">Não foi possível conectar</h1>
          <p className="text-sm text-muted-foreground break-words">{status.message}</p>
        </div>
        {status.diag && <DiagPanel diag={status.diag} />}
        <Button onClick={() => navigate({ to: "/painel/redes-sociais" })} className="w-full">
          Voltar para Redes Sociais
        </Button>
      </div>
    </MetaCallbackCard>
  );
}

function DiagPanel({ diag }: { diag: MetaDiag }) {
  return (
    <div className="space-y-3 text-xs">
      <Block title="Tokens (fingerprint, sem expor o valor)">
        <pre className="font-mono whitespace-pre-wrap break-words">
{JSON.stringify({ short_token: diag.short_token, long_token: diag.long_token }, null, 2)}
        </pre>
      </Block>
      <Block title="debug_token — token curto (raw)">
        <pre className="font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
{JSON.stringify(diag.debug_token_short, null, 2)}
        </pre>
      </Block>
      <Block title="debug_token — token longo (raw)">
        <pre className="font-mono whitespace-pre-wrap break-words max-h-64 overflow-auto">
{JSON.stringify(diag.debug_token_long, null, 2)}
        </pre>
      </Block>
      <Block title={`/me/accounts (status ${diag.me_accounts?.status ?? "?"}, pages=${diag.me_accounts?.pages_count ?? 0})`}>
        <div className="mb-2 font-mono break-words">{diag.me_accounts?.request_url}</div>
        <div className="mb-2">
          <div className="font-semibold">Headers</div>
          <pre className="font-mono whitespace-pre-wrap break-words">
{JSON.stringify(diag.me_accounts?.headers ?? {}, null, 2)}
          </pre>
        </div>
        <div>
          <div className="font-semibold">Body</div>
          <pre className="font-mono whitespace-pre-wrap break-words max-h-72 overflow-auto">
{JSON.stringify(diag.me_accounts?.body, null, 2)}
          </pre>
        </div>
      </Block>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3">
      <div className="font-semibold mb-1">{title}</div>
      {children}
    </div>
  );
}

function MetaCallbackCard({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-2xl border bg-card p-8 shadow-xl`}>
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
