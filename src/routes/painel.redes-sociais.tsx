import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { generateMetaOAuthState } from "@/lib/meta-oauth";
import {
  Share2, Facebook, Instagram, CheckCircle2, AlertTriangle,
  BarChart3, MessageSquare, Sparkles, Clock, Unplug, RefreshCw, ShieldCheck,
} from "lucide-react";


export const Route = createFileRoute("/painel/redes-sociais")({
  component: RedesSociaisPage,
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

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("social_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("platform", "meta")
      .maybeSingle();
    if (error) toast.error(error.message);
    setConn((data as Connection | null) ?? null);
    setLoading(false);
  }

  useEffect(() => { void load(); }, [user?.id]);

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.origin !== window.location.origin) return;
      if (ev.data?.type === "meta-oauth-success") void load();
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
    const state = generateMetaOAuthState();
    sessionStorage.setItem("meta_oauth_state", state);

    const response = await fetch(`/api/public/meta/oauth?state=${encodeURIComponent(state)}`, {
      method: "GET",
      credentials: "include",
    });

    let payload: { url?: string; error?: string } | null = null;
    try {
      payload = (await response.json()) as { url?: string; error?: string };
    } catch {
      payload = null;
    }

    if (!response.ok || !payload?.url) {
      toast.error(payload?.error || "Não foi possível iniciar a conexão com a Meta.");
      return;
    }

    const w = 600, h = 750;
    const left = window.screenX + (window.outerWidth - w) / 2;
    const top = window.screenY + (window.outerHeight - h) / 2;

    const popup = window.open(
      payload.url,
      "meta-oauth",
      `width=${w},height=${h},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`,
    );

    if (popup && !popup.closed) {
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          void load();
        }
      }, 800);
      return;
    }

    window.location.href = payload.url;
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

      {/* Placeholders */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Em breve, com sua conta conectada</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <PlaceholderCard
            icon={<BarChart3 className="h-5 w-5" />}
            title="Métricas em tempo real"
            description="Alcance, impressões, engajamento e crescimento de seguidores agregados por período."
          />
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
