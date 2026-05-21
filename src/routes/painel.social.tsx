import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addSocialProfile,
  deleteSocialProfile,
  getSocialDashboard,
  listSocialPosts,
  listSocialProfiles,
  updateSocialProfile,
} from "@/lib/social.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";

export const Route = createFileRoute("/painel/social")({
  component: SocialPage,
});

type Platform = "instagram" | "tiktok" | "facebook" | "youtube" | "twitter";

function SocialPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <header>
        <h1 className="text-2xl font-semibold">Inteligência Social</h1>
        <p className="text-sm text-muted-foreground">
          Monitore perfis em redes sociais. Coleta executada por worker externo.
        </p>
      </header>

      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Perfis</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="ops">Operação</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-4">
          <AddProfile />
          <ProfilesList />
        </TabsContent>

        <TabsContent value="posts">
          <PostsList />
        </TabsContent>

        <TabsContent value="ops">
          <OpsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AddProfile() {
  const qc = useQueryClient();
  const addFn = useServerFn(addSocialProfile);
  const [platform, setPlatform] = useState<Platform>("instagram");
  const [username, setUsername] = useState("");
  const [isOwn, setIsOwn] = useState(true);

  const mut = useMutation({
    mutationFn: (vars: { platform: Platform; username: string; is_own: boolean }) =>
      addFn({ data: { ...vars, check_interval_minutes: 360 } }),
    onSuccess: () => {
      toast.success("Perfil adicionado");
      setUsername("");
      qc.invalidateQueries({ queryKey: ["social-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Adicionar perfil</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Plataforma</label>
          <Select value={platform} onValueChange={(v) => setPlatform(v as Platform)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="twitter">Twitter / X</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">Usuário (sem @)</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="ex: meucanal"
            className="w-56"
          />
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch checked={isOwn} onCheckedChange={setIsOwn} id="is-own" />
          <label htmlFor="is-own" className="text-sm">Próprio</label>
        </div>
        <Button
          onClick={() => username.trim() && mut.mutate({ platform, username: username.trim(), is_own: isOwn })}
          disabled={mut.isPending || !username.trim()}
        >
          {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar
        </Button>
      </CardContent>
    </Card>
  );
}

function ProfilesList() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSocialProfiles);
  const updateFn = useServerFn(updateSocialProfile);
  const delFn = useServerFn(deleteSocialProfile);

  const q = useQuery({
    queryKey: ["social-profiles"],
    queryFn: () => listFn(),
  });

  const toggle = useMutation({
    mutationFn: (vars: { id: string; is_active: boolean }) => updateFn({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social-profiles"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Perfil removido");
      qc.invalidateQueries({ queryKey: ["social-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (q.error) return <div className="p-6 text-sm text-destructive">{(q.error as Error).message}</div>;

  const profiles = q.data?.profiles ?? [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Perfis monitorados ({profiles.length})</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["social-profiles"] })}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {profiles.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum perfil cadastrado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {profiles.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="capitalize">{p.platform}</Badge>
                  <div>
                    <div className="font-medium">@{p.username}</div>
                    <div className="text-xs text-muted-foreground">
                      {p.is_own ? "Próprio" : "Concorrente"} ·
                      checa a cada {p.check_interval_minutes}min ·
                      {p.last_checked_at ? ` última: ${new Date(p.last_checked_at).toLocaleString()}` : " nunca coletado"}
                      {p.last_error ? ` · erro: ${p.last_error.slice(0, 80)}` : ""}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={(v) => toggle.mutate({ id: p.id, is_active: v })}
                  />
                  <Button variant="ghost" size="icon" onClick={() => del.mutate(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function PostsList() {
  const listFn = useServerFn(listSocialPosts);
  const q = useQuery({
    queryKey: ["social-posts"],
    queryFn: () => listFn({ data: { limit: 50 } }),
  });

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (q.error) return <div className="p-6 text-sm text-destructive">{(q.error as Error).message}</div>;

  const posts = q.data?.posts ?? [];

  if (posts.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">Nenhum post coletado ainda.</CardContent></Card>;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <Card key={p.id} className="overflow-hidden">
          {p.thumbnail_url ? (
            <img src={p.thumbnail_url} alt="" className="aspect-square w-full object-cover" loading="lazy" />
          ) : (
            <div className="aspect-square w-full bg-muted" />
          )}
          <CardContent className="space-y-1 p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <Badge variant="outline" className="capitalize">{p.platform}</Badge>
              <span>{p.posted_at ? new Date(p.posted_at).toLocaleDateString() : "—"}</span>
            </div>
            <p className="line-clamp-3 text-sm">{p.caption || "(sem legenda)"}</p>
            <div className="flex gap-3 text-xs text-muted-foreground">
              <span>❤ {p.likes ?? 0}</span>
              <span>💬 {p.comments ?? 0}</span>
              <span>👁 {p.views ?? 0}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

type DashStats = {
  jobs?: Record<string, number>;
  workers_online?: number;
  workers_total?: number;
  workers?: Array<{ worker_id: string; status: string; last_seen_at: string; jobs_processed: number; last_error?: string | null; is_online: boolean }>;
  profiles_active?: number;
  profiles_total?: number;
  posts_today?: number;
  posts_total?: number;
  recent_errors?: Array<{ id: number; created_at: string; worker_id?: string | null; level: string; kind: string; message: string }>;
  breaker?: { breaker_open: boolean; breaker_reason?: string | null; breaker_reset_at?: string | null };
};

function OpsPanel() {
  const dashFn = useServerFn(getSocialDashboard);
  const q = useQuery({
    queryKey: ["social-dashboard"],
    queryFn: () => dashFn(),
    refetchInterval: 10_000,
  });

  if (q.isLoading) return <div className="p-6 text-sm text-muted-foreground">Carregando…</div>;
  if (q.error) return <div className="p-6 text-sm text-destructive">{(q.error as Error).message}</div>;

  const s = (q.data?.stats ?? {}) as DashStats;
  const jobs = s.jobs ?? {};

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Workers online" value={`${s.workers_online ?? 0} / ${s.workers_total ?? 0}`} />
        <StatCard label="Perfis ativos" value={`${s.profiles_active ?? 0} / ${s.profiles_total ?? 0}`} />
        <StatCard label="Posts hoje" value={String(s.posts_today ?? 0)} />
        <StatCard label="Posts no total" value={String(s.posts_total ?? 0)} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Fila de jobs</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          {["pending", "running", "done", "failed"].map((k) => (
            <Badge key={k} variant="outline" className="text-sm">
              {k}: <span className="ml-1 font-mono">{jobs[k] ?? 0}</span>
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Circuit breaker</CardTitle></CardHeader>
        <CardContent className="text-sm">
          {s.breaker?.breaker_open ? (
            <div className="text-destructive">
              ABERTO — {s.breaker.breaker_reason}
              {s.breaker.breaker_reset_at && (
                <span className="ml-2 text-muted-foreground">
                  reset {new Date(s.breaker.breaker_reset_at).toLocaleString()}
                </span>
              )}
            </div>
          ) : (
            <div className="text-emerald-600">Fechado — coleta operando normalmente</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Workers</CardTitle></CardHeader>
        <CardContent>
          {(s.workers ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum worker registrado.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(s.workers ?? []).map((w) => (
                <li key={w.worker_id} className="flex items-center justify-between gap-2 rounded border p-2">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${w.is_online ? "bg-emerald-500" : "bg-muted-foreground"}`} />
                    <span className="font-mono">{w.worker_id}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {w.jobs_processed} jobs · visto {new Date(w.last_seen_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Erros recentes</CardTitle></CardHeader>
        <CardContent>
          {(s.recent_errors ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem erros recentes.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {(s.recent_errors ?? []).map((l) => (
                <li key={l.id} className="rounded border p-2">
                  <div className="flex justify-between">
                    <span className="font-mono">{l.level} / {l.kind}</span>
                    <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                  </div>
                  <div>{l.message}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}
