import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { createMetaOAuthState, META_OAUTH_STATE_STORAGE_KEY, parseMetaOAuthState } from "@/lib/meta-oauth";
import { useServerFn } from "@tanstack/react-start";
import { connectMetaAccount } from "@/lib/meta-connect.functions";
import {
  Share2, Facebook, Instagram, CheckCircle2, AlertTriangle,
  MessageSquare, Sparkles, Clock, Unplug, RefreshCw, ShieldCheck,
  Activity, Trash2, BarChart3,
} from "lucide-react";
import { MetricsPanel } from "@/components/social/MetricsPanel";


type DiagStep = {
  at: string;
  kind: "info" | "success" | "error" | "warn";
  label: string;
  detail?: string;
};


export const Route = createFileRoute("/painel/redes-sociais")({
  component: RedesSociaisPage,
  errorComponent: ({ error, reset }) => (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div>
        <h2 className="text-lg font-semibold text-destructive">Algo deu errado nesta página</h2>
        <p className="mt-1 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Erro desconhecido"}</p>
      </div>
      <Button variant="outline" size="sm" onClick={() => reset()}>
        Tentar novamente
      </Button>
    </div>
  ),
});

type Connection = {
  id: string;
  user_id: string;
  platform: string;
  status: string;
  page_id: string | null;
  page_name: string | null;
  page_picture_url: string | null;
  instagram_business_id: string | null;
  instagram_username: string | null;
  instagram_picture_url: string | null;
  expires_at: string | null;
  created_at: string;
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null) {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function RedesSociaisPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [conn, setConn] = useState<Connection | null>(null);
  const [busy, setBusy] = useState(false);
  const [diag, setDiag] = useState<DiagStep[]>([]);
  const connectFn = useServerFn(connectMetaAccount);

  function pushDiag(step: Omit<DiagStep, "at">) {
    const entry: DiagStep = { at: new Date().toISOString(), ...step };
    setDiag((d) => [entry, ...d].slice(0, 30));
    const logFn = step.kind === "error" ? console.error : step.kind === "warn" ? console.warn : console.log;
    logFn(`[diag:${step.kind}] ${step.label}`, step.detail ?? "");
  }

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "meta")
      .maybeSingle();
    if (error) {
      toast.error(error.message);
      pushDiag({ kind: "error", label: "Falha ao consultar social_connections", detail: error.message });
    } else {
      pushDiag({
        kind: data ? "success" : "info",
        label: data ? `Conexão carregada do banco: ${data.page_name ?? data.page_id ?? "(sem nome)"}` : "Nenhuma conexão Meta encontrada para este usuário",
        detail: data ? `status=${data.status} · page_id=${data.page_id} · ig=${data.instagram_username ?? "-"}` : `user_id=${user.id}`,
      });
    }
    setConn((data as Connection | null) ?? null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user?.id]);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (!ev.data || typeof ev.data !== "object") return;
      const type = (ev.data as { type?: string }).type;
      if (type !== "meta-oauth-callback" && type !== "meta-oauth-success") return;

      pushDiag({
        kind: "info",
        label: `postMessage recebido: ${type}`,
        detail: `origin=${ev.origin} · windowOrigin=${window.location.origin}`,
      });

      if (ev.origin !== window.location.origin) {
        pushDiag({ kind: "warn", label: "Mensagem ignorada (origem diferente)", detail: `esperado=${window.location.origin} · recebido=${ev.origin}` });
        return;
      }

      if (type === "meta-oauth-success") {
        void load();
        return;
      }

      const storedState = sessionStorage.getItem(META_OAUTH_STATE_STORAGE_KEY);
      const parsedStored = storedState ? parseMetaOAuthState(storedState) : null;
      const parsedIncoming = typeof ev.data.state === "string" ? parseMetaOAuthState(ev.data.state) : null;
      const nonceOk = !!parsedStored && !!parsedIncoming && parsedStored.nonce === parsedIncoming.nonce;

      pushDiag({
        kind: nonceOk ? "success" : "warn",
        label: nonceOk ? "State OAuth validado (nonce confere)" : "State OAuth NÃO confere",
        detail: `hasStored=${!!storedState} · parsedStoredOk=${!!parsedStored} · parsedIncomingOk=${!!parsedIncoming}`,
      });

      if (!nonceOk) {
        toast.error("State OAuth inválido no retorno da Meta.");
        return;
      }

      const code = typeof ev.data.code === "string" ? ev.data.code : "";
      if (!code) {
        const errorMessage = typeof ev.data.error === "string" && ev.data.error
          ? ev.data.error
          : "Código de autorização não retornado pela Meta.";
        pushDiag({ kind: "error", label: "Sem code no retorno", detail: errorMessage });
        toast.error(errorMessage);
        return;
      }

      pushDiag({ kind: "info", label: "Chamando connectMetaAccount serverFn…", detail: `code length=${code.length}` });
      setBusy(true);
      void connectFn({ data: { code } })
        .then((result) => {
          sessionStorage.removeItem(META_OAUTH_STATE_STORAGE_KEY);
          pushDiag({
            kind: "success",
            label: `serverFn OK · page=${result?.page_name ?? "?"}`,
            detail: `page_id=${result?.page_id} · ig=${result?.instagram_username ?? "-"} · expires_at=${result?.expires_at ?? "-"}${result?.warning ? ` · warning=${result.warning}` : ""}`,
          });
          toast.success(result?.page_name ? `Página conectada: ${result.page_name}` : "Conta Meta conectada com sucesso.");
          if (result?.warning) {
            toast.warning(result.warning, { duration: 12000 });
          }
          void load();
        })

        .catch((error) => {
          const message = error instanceof Error ? error.message : "Falha ao concluir conexão com a Meta.";
          pushDiag({ kind: "error", label: "serverFn connectMetaAccount falhou", detail: message });
          toast.error(message);
        })
        .finally(() => {
          setBusy(false);
        });
    }

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  async function handleConnect() {
    if (!user) {
      toast.error("Você precisa estar autenticado.");
      return;
    }
    const state = createMetaOAuthState(window.location.origin);
    sessionStorage.setItem(META_OAUTH_STATE_STORAGE_KEY, state);
    pushDiag({ kind: "info", label: "Iniciando OAuth Meta", detail: `origin=${window.location.origin}` });

    const response = await fetch(`/api/public/meta/oauth?state=${encodeURIComponent(state)}`, {
      method: "GET",
      credentials: "include",
    });

    let data: { url?: string; error?: string; stack?: string; env?: unknown } | null = null;
    try {
      data = await response.json();
    } catch (e) {
      pushDiag({ kind: "error", label: "Resposta /api/public/meta/oauth não é JSON", detail: String(e) });
    }

    if (!response.ok) {
      pushDiag({ kind: "error", label: `HTTP ${response.status} em /api/public/meta/oauth`, detail: data?.error ?? "" });
      toast.error(data?.error || `Erro ${response.status} ao iniciar conexão Meta.`);
      return;
    }

    if (!data?.url) {
      pushDiag({ kind: "error", label: "Servidor não retornou OAuth URL", detail: JSON.stringify(data) });
      toast.error("OAuth URL ausente na resposta do servidor.");
      return;
    }

    pushDiag({ kind: "success", label: "OAuth URL recebida, abrindo popup", detail: new URL(data.url).host });

    const w = 600, h = 750;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;

    const popup = window.open(
      data.url,
      "meta-oauth",
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );
    if (popup && !popup.closed) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          pushDiag({ kind: "info", label: "Popup fechada, recarregando conexão", detail: "" });
          void load();
        }
      }, 800);
      return;
    }

    pushDiag({ kind: "warn", label: "Popup bloqueada, redirecionando na mesma aba", detail: "" });
    window.location.href = data.url;
  }


  async function handleDisconnect() {
    if (!conn) return;
    if (!confirm("Desconectar sua conta Meta?")) return;
    setBusy(true);
    const { error } = await supabase.from("social_connections").delete().eq("id", conn.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Conexão removida");
    setConn(null);
  }

  const expiresInDays = daysUntil(conn?.expires_at ?? null);
  const isConnected = !!conn?.page_id && conn?.status === "connected";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-primary/15 p-3 text-primary">
              <Share2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Redes Sociais</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Conecte sua página do Facebook e seu Instagram profissional para liberar métricas,
                resposta a comentários e análise de sentimento com IA.
              </p>
            </div>
          </div>
          <div>
            {isConnected ? (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Conectado
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1.5 px-3 py-1.5 text-xs">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Não conectado
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Connection card */}
      <Card className="overflow-hidden border-2">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="rounded-full bg-[#1877F2] p-2 ring-2 ring-background">
                <Facebook className="h-5 w-5 text-white" />
              </div>
              <div className="rounded-full bg-gradient-to-tr from-[#feda75] via-[#d62976] to-[#4f5bd5] p-2 ring-2 ring-background">
                <Instagram className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <CardTitle>Meta Business</CardTitle>
              <CardDescription>Facebook Page + Instagram Business via OAuth oficial</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-2/3" />
            </div>
          ) : isConnected && conn ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Facebook */}
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Facebook className="h-3.5 w-3.5" /> Página do Facebook
                  </div>
                  <div className="flex items-center gap-3">
                    {conn.page_picture_url ? (
                      <img src={conn.page_picture_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Facebook className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{conn.page_name ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">ID: {conn.page_id ?? "—"}</p>
                    </div>
                  </div>
                </div>

                {/* Instagram */}
                <div className="rounded-xl border bg-card p-4">
                  <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Instagram className="h-3.5 w-3.5" /> Conta do Instagram
                  </div>
                  <div className="flex items-center gap-3">
                    {conn.instagram_picture_url ? (
                      <img src={conn.instagram_picture_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                        <Instagram className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold">@{conn.instagram_username ?? "—"}</p>
                      <p className="truncate text-xs text-muted-foreground">Business ID: {conn.instagram_business_id ?? "—"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 sm:grid-cols-3">
                <InfoTile icon={<ShieldCheck className="h-4 w-4" />} label="Status" value={conn.status} valueClass="capitalize" />
                <InfoTile icon={<Clock className="h-4 w-4" />} label="Expira em" value={fmtDate(conn.expires_at)}
                  hint={expiresInDays !== null ? `em ${expiresInDays} dias` : undefined} />
                <InfoTile icon={<RefreshCw className="h-4 w-4" />} label="Conectado em" value={fmtDate(conn.created_at)} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button asChild className="gap-2">
                  <Link to="/painel/redes-sociais/comentarios">
                    <MessageSquare className="h-4 w-4" /> Abrir Central de Comentários
                  </Link>
                </Button>
                <Button variant="outline" onClick={handleConnect}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Renovar token
                </Button>
                <Button variant="ghost" className="text-destructive hover:text-destructive" disabled={busy} onClick={handleDisconnect}>
                  <Unplug className="mr-2 h-4 w-4" /> Desconectar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 py-6 text-center">
              <div className="rounded-full bg-muted p-4">
                <Share2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="max-w-md">
                <h3 className="text-lg font-semibold">Conecte suas contas em um clique</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Usamos o login oficial da Meta — não armazenamos sua senha. Você pode revogar o acesso a qualquer momento.
                </p>
              </div>
              <Button size="lg" className="gap-2 bg-gradient-to-r from-[#1877F2] to-[#d62976] text-white hover:opacity-95" onClick={handleConnect}>
                <Facebook className="h-4 w-4" />
                <Instagram className="h-4 w-4" />
                Conectar Facebook e Instagram
              </Button>
              <p className="text-xs text-muted-foreground">
                Permissões: <code>pages_show_list</code>, <code>instagram_basic</code>, <code>instagram_manage_insights</code>, <code>instagram_manage_comments</code>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnóstico ao vivo do fluxo OAuth */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2 text-primary"><Activity className="h-5 w-5" /></div>
              <div>
                <CardTitle className="text-base">Diagnóstico da conexão Meta</CardTitle>
                <CardDescription>Cada etapa do fluxo OAuth aparece aqui em tempo real — útil para entender por que a conexão falhou.</CardDescription>
              </div>
            </div>
            {diag.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setDiag([])}>
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpar
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {diag.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento ainda. Clique em <strong>Conectar</strong> para iniciar.</p>
          ) : (
            <ol className="space-y-2">
              {diag.map((d, i) => {
                const color =
                  d.kind === "success" ? "border-emerald-500/40 bg-emerald-500/5" :
                  d.kind === "error" ? "border-destructive/40 bg-destructive/5" :
                  d.kind === "warn" ? "border-amber-500/40 bg-amber-500/5" :
                  "border-border bg-muted/30";
                return (
                  <li key={i} className={`rounded-md border px-3 py-2 text-xs ${color}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{d.label}</span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {new Date(d.at).toLocaleTimeString("pt-BR")}
                      </span>
                    </div>
                    {d.detail && (
                      <pre className="mt-1 whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">{d.detail}</pre>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>


      {/* Métricas em tempo real */}
      {conn && conn.status === "connected" && (
        <MetricsPanel />
      )}


      {/* Placeholders */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Em breve</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <PlaceholderCard
            icon={<MessageSquare className="h-5 w-5" />}
            title="Central de comentários"
            description="Responda comentários do Instagram e Facebook direto do painel, com sugestões prontas."
          />
          <PlaceholderCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Sentimento com IA"
            description="Classificação automática de comentários em positivo, neutro e negativo — com resumo executivo."
          />
        </div>
      </div>

    </div>
  );
}

function InfoTile({ icon, label, value, hint, valueClass }: { icon: React.ReactNode; label: string; value: string; hint?: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon} {label}</div>
      <p className={`mt-1 font-medium ${valueClass ?? ""}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function PlaceholderCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <Card className="relative overflow-hidden border-dashed">
      <div className="absolute right-3 top-3">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">Em breve</Badge>
      </div>
      <CardHeader>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <CardTitle className="mt-3 text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </CardContent>
    </Card>
  );
}
