import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getSocialOpsStats, forceEnqueueSocial } from "@/lib/social.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AlertTriangle, Activity, Database, Users, Clock, ShieldAlert, Zap } from "lucide-react";
import { withSocialAuth, getSocialErrorMessage as getSocialClientErrorMessage } from "@/lib/social-client";

function readableError(error: unknown): string {
  const socialMessage = getSocialClientErrorMessage(error);
  if (socialMessage) return socialMessage;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  return "Erro ao carregar dados da inteligência social";
}

function formatRel(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Math.round((Date.now() - d) / 1000);
  if (diff < 60) return `${diff}s atrás`;
  if (diff < 3600) return `${Math.round(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h atrás`;
  return `${Math.round(diff / 86400)}d atrás`;
}

export function SocialOpsPanel({ ready }: { ready: boolean }) {
  const fetchStats = useServerFn(getSocialOpsStats);
  const forceEnqueue = useServerFn(forceEnqueueSocial);
  const [forcing, setForcing] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    let stopped = false;
    const load = async () => {
      try {
        const r: any = await withSocialAuth((options) => fetchStats(options));
        if (r?.ok === false) throw new Error(r?.message || "Erro");
        if (!cancelled) {
          setData(r);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(readableError(e));
          stopped = true; // para o polling em caso de erro persistente
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const id = setInterval(() => {
      if (stopped) return;
      load();
    }, 20_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [ready, fetchStats]);

  if (!ready) return <p className="text-muted-foreground">Carregando sessão…</p>;
  if (loading && !data) return <p className="text-muted-foreground">Carregando estatísticas…</p>;
  if (error && !data) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-4 space-y-2">
          <div className="font-semibold text-destructive">Não foi possível carregar a operação</div>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  const s: any = (data as any)?.stats ?? {};
  const jobs = s.jobs ?? {};
  const breaker = s.breaker ?? {};
  const workers: any[] = s.workers ?? [];
  const recent: any[] = s.recent_errors ?? [];

  const onForce = async () => {
    setForcing(true);
    try {
      const r: any = await withSocialAuth((options) => forceEnqueue({ data: {}, ...options }));
      if (r?.ok === false) throw new Error(r?.message || "Erro ao forçar coleta");
      toast.success(r?.message || `${r?.enqueued ?? 0} job(s) criado(s)`);
      const stats: any = await withSocialAuth((options) => fetchStats(options));
      if (stats?.ok === false) throw new Error(stats?.message || "Erro");
      setData(stats);
    } catch (e) {
      toast.error(readableError(e));
    } finally {
      setForcing(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onForce} disabled={forcing} size="sm">
          <Zap className="size-4 mr-2" />
          {forcing ? "Enfileirando…" : "Forçar coleta agora"}
        </Button>
      </div>
      {breaker.breaker_open && (
        <Card className="border-destructive">
          <CardContent className="pt-4 flex items-start gap-3">
            <ShieldAlert className="text-destructive shrink-0 mt-1" />
            <div>
              <div className="font-semibold text-destructive">Crawler pausado (circuit breaker aberto)</div>
              <div className="text-sm text-muted-foreground mt-1">{breaker.breaker_reason || "sem motivo"}</div>
              {breaker.breaker_reset_at && (
                <div className="text-xs text-muted-foreground mt-1">
                  Reativação prevista: {new Date(breaker.breaker_reset_at).toLocaleString("pt-BR")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Activity className="size-4" />} label="Workers online" value={`${s.workers_online ?? 0}/${s.workers_total ?? 0}`} />
        <StatCard icon={<Database className="size-4" />} label="Posts hoje" value={s.posts_today ?? 0} sub={`${s.snapshots_today ?? 0} snapshots`} />
        <StatCard icon={<Users className="size-4" />} label="Perfis ativos" value={s.profiles_active ?? 0} />
        <StatCard icon={<Clock className="size-4" />} label="Última coleta" value={formatRel(s.last_collection_at)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pending" value={jobs.pending ?? 0} />
        <StatCard label="Running" value={jobs.running ?? 0} />
        <StatCard label="Done" value={jobs.done ?? 0} />
        <StatCard label="Failed" value={jobs.failed ?? 0} tone={(jobs.failed ?? 0) > 0 ? "warn" : undefined} />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Workers</CardTitle></CardHeader>
        <CardContent>
          {workers.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum worker registrado ainda. Inicie o crawler.</p>
          ) : (
            <ScrollArea className="max-h-72">
              <div className="space-y-2">
                {workers.map((w) => (
                  <div key={w.worker_id} className="flex items-center justify-between border-b py-2 last:border-0">
                    <div>
                      <div className="font-mono text-sm">{w.worker_id}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRel(w.last_seen_at)} · {w.jobs_processed ?? 0} jobs
                        {w.last_error ? ` · erro: ${w.last_error}` : ""}
                      </div>
                    </div>
                    <Badge variant={w.is_online ? "default" : "secondary"}>
                      {w.is_online ? "online" : "offline"}
                    </Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2 flex flex-row items-center gap-2">
          <AlertTriangle className="size-4 text-amber-500" />
          <CardTitle className="text-base">Últimos erros operacionais</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem erros recentes.</p>
          ) : (
            <ScrollArea className="max-h-80">
              <div className="space-y-2">
                {recent.map((l) => (
                  <div key={l.id} className="border-b py-2 last:border-0 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={l.level === "critical" ? "destructive" : l.level === "error" ? "destructive" : "secondary"}>
                        {l.level}
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">{l.kind}</span>
                      <span className="text-xs text-muted-foreground ml-auto">{formatRel(l.created_at)}</span>
                    </div>
                    <div className="mt-1 text-foreground">{l.message}</div>
                    {l.worker_id && <div className="text-xs text-muted-foreground">worker: {l.worker_id}</div>}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone }: { icon?: React.ReactNode; label: string; value: React.ReactNode; sub?: string; tone?: "warn" }) {
  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {icon}{label}
        </div>
        <div className={`mt-1 text-2xl font-semibold ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
