import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3, TrendingUp, TrendingDown, Eye, Users, Heart, MessageCircle,
  RefreshCw, AlertTriangle, Instagram, Facebook, ExternalLink,
} from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { getMetaInsights, type InsightsResult, type KpiDelta, type TopPost } from "@/lib/meta-insights.functions";

const PERIODS = [
  { value: "7", label: "7 dias" },
  { value: "30", label: "30 dias" },
  { value: "90", label: "90 dias" },
] as const;

function fmtNum(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(n)) return "0";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return n.toLocaleString("pt-BR");
}

function fmtPct(p: number | null): string {
  if (p === null || !isFinite(p)) return "—";
  const sign = p > 0 ? "+" : "";
  return `${sign}${p.toFixed(1)}%`;
}

function KpiCard({
  icon, label, kpi, hint,
}: { icon: React.ReactNode; label: string; kpi: KpiDelta; hint?: string }) {
  const up = kpi.delta > 0;
  const down = kpi.delta < 0;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">{icon} {label}</span>
        {kpi.deltaPct !== null && (
          <span
            className={`flex items-center gap-0.5 font-medium ${
              up ? "text-emerald-500" : down ? "text-destructive" : ""
            }`}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : down ? <TrendingDown className="h-3 w-3" /> : null}
            {fmtPct(kpi.deltaPct)}
          </span>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{fmtNum(kpi.current)}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SeriesChart({
  data, color, label,
}: { data: Array<{ date: string; value: number }> | undefined | null; color: string; label: string }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-xs text-muted-foreground">
        Sem dados de {label} no período.
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(v) => (typeof v === 'string' ? v.slice(5) : '')} />
        <YAxis tick={{ fontSize: 10 }} tickFormatter={fmtNum} />
        <Tooltip
          contentStyle={{
            background: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(v: number) => [fmtNum(v), label]}
        />
        <Area type="monotone" dataKey="value" stroke={color} fill={`url(#grad-${label})`} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function TopPostRow({ post }: { post: TopPost }) {
  return (
    <a
      href={post.permalink ?? "#"}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-lg border bg-card p-3 transition hover:bg-muted/40"
    >
      {post.thumbnail_url ? (
        <img src={post.thumbnail_url} alt="" className="h-14 w-14 rounded-md object-cover" />
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted">
          <Instagram className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-xs text-foreground/90">
          {post.caption ?? "(sem legenda)"}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {fmtNum(post.likes)}</span>
          <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {fmtNum(post.comments)}</span>
          <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {fmtNum(post.reach)}</span>
          {post.posted_at && (
            <span>{new Date(post.posted_at).toLocaleDateString("pt-BR")}</span>
          )}
        </div>
      </div>
      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
    </a>
  );
}

export function MetricsPanel() {
  const [period, setPeriod] = useState<"7" | "30" | "90">("30");
  const fetchInsights = useServerFn(getMetaInsights);

  const query = useQuery<InsightsResult>({
    queryKey: ["meta-insights", period],
    queryFn: () => fetchInsights({ data: { period } }),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><BarChart3 className="h-5 w-5" /></div>
            <div>
              <CardTitle className="text-base">Métricas em tempo real</CardTitle>
              <CardDescription>
                Dados oficiais do Instagram Business e da página do Facebook
                {query.data?.cached ? " · em cache (≤ 1h)" : ""}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as "7" | "30" | "90")}>
              <TabsList>
                {PERIODS.map((p) => (
                  <TabsTrigger key={p.value} value={p.value}>{p.label}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={() => query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {query.isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        )}

        {query.isError && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Não foi possível carregar as métricas</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {query.error instanceof Error ? query.error.message : "Erro desconhecido"}
              </p>
            </div>
          </div>
        )}

        {query.data && (
          <>
            {(query.data.warnings || []).length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-3.5 w-3.5" /> Alguns dados não puderam ser obtidos
                </p>
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                  {query.data.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            {query.data.instagram && (
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <Instagram className="h-4 w-4 text-[#d62976]" />
                  <h3 className="text-sm font-semibold">
                    Instagram {query.data.instagram.username ? `· @${query.data.instagram.username}` : ""}
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <KpiCard icon={<Users className="h-3.5 w-3.5" />} label="Seguidores" kpi={query.data.instagram.followers} hint={`vs ${period}d atrás`} />
                  <KpiCard icon={<Eye className="h-3.5 w-3.5" />} label="Alcance" kpi={query.data.instagram.reach} hint="contas únicas" />
                  <KpiCard icon={<TrendingUp className="h-3.5 w-3.5" />} label="Impressões" kpi={query.data.instagram.impressions} />
                  <KpiCard icon={<BarChart3 className="h-3.5 w-3.5" />} label="Visitas ao perfil" kpi={query.data.instagram.profile_views} />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-xl border bg-card p-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Alcance diário</p>
                    <SeriesChart data={query.data.instagram.reach_series} color="#d62976" label="Alcance" />
                  </div>
                  <div className="rounded-xl border bg-card p-4">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Impressões diárias</p>
                    <SeriesChart data={query.data.instagram.impressions_series} color="#4f5bd5" label="Impressões" />
                  </div>
                </div>
                {query.data.instagram.top_posts.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Top 5 posts por engajamento</p>
                    <div className="grid gap-2">
                      {query.data.instagram.top_posts.map((p) => <TopPostRow key={p.id} post={p} />)}
                    </div>
                  </div>
                )}
              </section>
            )}

            {query.data.facebook && (
              <section className="space-y-4 border-t pt-6">
                <div className="flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-[#1877F2]" />
                  <h3 className="text-sm font-semibold">
                    Facebook {query.data.facebook.page_name ? `· ${query.data.facebook.page_name}` : ""}
                  </h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <KpiCard icon={<Users className="h-3.5 w-3.5" />} label="Fãs da página" kpi={query.data.facebook.fans} />
                  <KpiCard icon={<Eye className="h-3.5 w-3.5" />} label="Alcance" kpi={query.data.facebook.reach} />
                  <KpiCard icon={<Heart className="h-3.5 w-3.5" />} label="Engajamento" kpi={query.data.facebook.engagement} />
                </div>
                <div className="rounded-xl border bg-card p-4">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Alcance diário</p>
                  <SeriesChart data={query.data.facebook.reach_series} color="#1877F2" label="Alcance FB" />
                </div>
              </section>
            )}

            {!query.data.instagram && !query.data.facebook && (
              <div className="rounded-lg border bg-muted/30 p-6 text-center">
                <Badge variant="outline">Nenhum dado disponível</Badge>
                <p className="mt-2 text-xs text-muted-foreground">
                  A Meta não retornou métricas. Verifique se sua conta do Instagram é Business/Creator
                  e está vinculada à página do Facebook conectada.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
