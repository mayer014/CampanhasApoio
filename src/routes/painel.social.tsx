import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  addSocialProfile,
  deleteSocialProfile,
  enqueueSocialProfileNow,
  getSocialDashboard,
  listSocialPosts,
  listSocialProfiles,
  updateSocialProfile,
} from "@/lib/social.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertCircle, ExternalLink, Heart, MessageSquare, Plus, Radar, Trash2, Eye, Play } from "lucide-react";

export const Route = createFileRoute("/painel/social")({
  component: SocialPage,
});

type ProfileType = "own_profile" | "competitor" | "portal" | "influencer";
const TYPE_LABEL: Record<ProfileType, string> = {
  own_profile: "Próprio",
  competitor: "Concorrente",
  portal: "Portal",
  influencer: "Influencer",
};
const TYPE_VARIANT: Record<ProfileType, "default" | "secondary" | "outline" | "destructive"> = {
  own_profile: "default",
  competitor: "destructive",
  portal: "secondary",
  influencer: "outline",
};

function relTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

function SocialPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Radar className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Inteligência Social</h1>
          <p className="text-sm text-muted-foreground">Monitoramento público de Instagram — Fase 1 (coleta incremental).</p>
        </div>
      </div>

      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Perfis</TabsTrigger>
          <TabsTrigger value="posts">Posts</TabsTrigger>
          <TabsTrigger value="ops">Operação</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="mt-4"><ProfilesTab /></TabsContent>
        <TabsContent value="posts" className="mt-4"><PostsTab /></TabsContent>
        <TabsContent value="ops" className="mt-4"><OpsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

/* =================== PROFILES =================== */

function ProfilesTab() {
  const list = useServerFn(listSocialProfiles);
  const add = useServerFn(addSocialProfile);
  const upd = useServerFn(updateSocialProfile);
  const del = useServerFn(deleteSocialProfile);
  const enqueueNow = useServerFn(enqueueSocialProfileNow);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["social", "profiles"],
    queryFn: () => list({ data: undefined as never }),
  });

  const addM = useMutation({
    mutationFn: (vars: { username: string; profile_type: ProfileType; check_interval_minutes: number }) =>
      add({ data: vars }),
    onSuccess: () => { toast.success("Perfil adicionado"); qc.invalidateQueries({ queryKey: ["social", "profiles"] }); setOpen(false); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updM = useMutation({
    mutationFn: (vars: { id: string; is_active?: boolean; profile_type?: ProfileType; check_interval_minutes?: number }) =>
      upd({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["social", "profiles"] }),
  });
  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => { toast.success("Perfil removido"); qc.invalidateQueries({ queryKey: ["social", "profiles"] }); },
  });
  const runNowM = useMutation({
    mutationFn: (id: string) => enqueueNow({ data: { profile_id: id } }),
    onSuccess: (r) => toast.success(r.reused ? "Já existe um job pendente para este perfil" : "Job enfileirado — aguarde o worker processar"),
    onError: (e: Error) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [ptype, setPtype] = useState<ProfileType>("competitor");
  const [interval, setIntervalMin] = useState(360);

  const profiles = (data?.profiles ?? []) as Array<{
    id: string; username: string; profile_type: ProfileType; is_active: boolean;
    last_checked_at: string | null; last_error: string | null; consecutive_errors: number;
    check_interval_minutes: number; followers_count: number | null;
  }>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>Perfis monitorados</CardTitle>
          <p className="text-sm text-muted-foreground">{profiles.length} cadastrado(s)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Adicionar perfil</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo perfil Instagram</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Usuário (@)</Label>
                <Input value={username} onChange={(e) => setUsername(e.target.value.replace(/^@/, ""))} placeholder="nome.do.perfil" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={ptype} onValueChange={(v) => setPtype(v as ProfileType)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="own_profile">Próprio</SelectItem>
                    <SelectItem value="competitor">Concorrente</SelectItem>
                    <SelectItem value="portal">Portal</SelectItem>
                    <SelectItem value="influencer">Influencer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Intervalo de coleta (minutos)</Label>
                <Input type="number" min={30} max={1440} value={interval} onChange={(e) => setIntervalMin(Number(e.target.value))} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button
                disabled={!username || addM.isPending}
                onClick={() => addM.mutate({ username, profile_type: ptype, check_interval_minutes: interval })}
              >Adicionar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p className="text-muted-foreground">Carregando…</p> :
         profiles.length === 0 ? <p className="text-muted-foreground">Nenhum perfil cadastrado ainda.</p> :
         <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>@</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Seguidores</TableHead>
                <TableHead>Intervalo</TableHead>
                <TableHead>Última coleta</TableHead>
                <TableHead>Erros</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono">@{p.username}</TableCell>
                  <TableCell><Badge variant={TYPE_VARIANT[p.profile_type]}>{TYPE_LABEL[p.profile_type]}</Badge></TableCell>
                  <TableCell>{p.followers_count?.toLocaleString("pt-BR") ?? "—"}</TableCell>
                  <TableCell>{p.check_interval_minutes}min</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{relTime(p.last_checked_at)}</TableCell>
                  <TableCell>
                    {p.consecutive_errors > 0
                      ? <span className="text-destructive text-sm" title={p.last_error ?? ""}>{p.consecutive_errors}× erro</span>
                      : <span className="text-muted-foreground text-sm">—</span>}
                  </TableCell>
                  <TableCell>
                    <Switch checked={p.is_active} onCheckedChange={(v) => updM.mutate({ id: p.id, is_active: v })} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Coletar agora"
                        disabled={runNowM.isPending}
                        onClick={() => runNowM.mutate(p.id)}
                      >
                        <Play className="h-4 w-4 text-primary" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Excluir @${p.username}?`)) delM.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>}
      </CardContent>
    </Card>
  );
}

/* =================== POSTS =================== */

function PostsTab() {
  const list = useServerFn(listSocialPosts);
  const { data, isLoading } = useQuery({
    queryKey: ["social", "posts"],
    queryFn: () => list({ data: { limit: 48 } }),
  });
  const posts = (data?.posts ?? []) as Array<{
    id: string; external_id: string; post_url: string | null;
    caption: string | null; thumbnail_url: string | null;
    likes: number | null; comments: number | null; views: number | null;
    posted_at: string | null;
  }>;
  if (isLoading) return <p className="text-muted-foreground">Carregando…</p>;
  if (posts.length === 0) return <p className="text-muted-foreground">Nenhum post coletado ainda. Aguarde a próxima execução do worker.</p>;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <Card key={p.id} className="overflow-hidden">
          {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="aspect-square w-full object-cover" loading="lazy" />}
          <CardContent className="space-y-2 p-4">
            <p className="line-clamp-3 text-sm">{p.caption || <span className="text-muted-foreground">Sem legenda</span>}</p>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Heart className="h-3 w-3" /> {p.likes ?? 0}</span>
              <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" /> {p.comments ?? 0}</span>
              {p.views ? <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {p.views}</span> : null}
              <span className="ml-auto">{p.posted_at ? new Date(p.posted_at).toLocaleDateString("pt-BR") : ""}</span>
            </div>
            {p.post_url && (
              <a href={p.post_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Abrir no Instagram <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* =================== OPS =================== */

function OpsTab() {
  const dash = useServerFn(getSocialDashboard);
  const { data } = useQuery({
    queryKey: ["social", "dashboard"],
    queryFn: () => dash({ data: undefined as never }),
    refetchInterval: 15000,
  });
  type Stats = {
    jobs?: Record<string, number>;
    workers_online?: number; workers_total?: number;
    posts_today?: number; posts_total?: number;
    profiles_active?: number; profiles_total?: number;
    breaker?: { breaker_open?: boolean; breaker_reason?: string | null };
    recent_errors?: Array<{ id: number; created_at: string; worker_id: string | null; level: string; kind: string; message: string }>;
  };
  const stats = (data?.stats ?? {}) as Stats;
  const alerts = (data?.alerts ?? []) as Array<{ id: string; alert_type: string; severity: string; title: string; message: string | null; created_at: string }>;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Workers</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.workers_online ?? 0}<span className="text-sm text-muted-foreground"> / {stats.workers_total ?? 0} online</span></p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Perfis ativos</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.profiles_active ?? 0}<span className="text-sm text-muted-foreground"> / {stats.profiles_total ?? 0}</span></p></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Posts hoje</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{stats.posts_today ?? 0}</p><p className="text-xs text-muted-foreground">{stats.posts_total ?? 0} no total</p></CardContent></Card>
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Circuit breaker</CardTitle></CardHeader>
          <CardContent>
            {stats.breaker?.breaker_open
              ? <Badge variant="destructive">ABERTO</Badge>
              : <Badge variant="secondary">FECHADO</Badge>}
            {stats.breaker?.breaker_reason && <p className="mt-1 text-xs text-muted-foreground">{stats.breaker.breaker_reason}</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Fila de jobs</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 text-sm">
            {Object.entries(stats.jobs ?? {}).map(([k, v]) => (
              <Badge key={k} variant="outline">{k}: <b className="ml-1">{v}</b></Badge>
            ))}
            {Object.keys(stats.jobs ?? {}).length === 0 && <p className="text-muted-foreground">Sem jobs.</p>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Alertas recentes</CardTitle></CardHeader>
        <CardContent>
          {alerts.length === 0 ? <p className="text-muted-foreground">Nenhum alerta ainda.</p> :
            <ul className="space-y-3">
              {alerts.map((a) => (
                <li key={a.id} className="flex items-start gap-3 rounded-md border p-3">
                  <AlertCircle className={`mt-0.5 h-4 w-4 ${a.severity === "critical" ? "text-destructive" : a.severity === "warn" ? "text-amber-500" : "text-muted-foreground"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.title}</p>
                    {a.message && <p className="text-xs text-muted-foreground">{a.message}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{relTime(a.created_at)}</span>
                </li>
              ))}
            </ul>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Erros recentes do worker</CardTitle></CardHeader>
        <CardContent>
          {(stats.recent_errors ?? []).length === 0 ? <p className="text-muted-foreground">Nenhum erro recente.</p> :
            <ul className="space-y-2 text-sm">
              {(stats.recent_errors ?? []).map((e) => (
                <li key={e.id} className="rounded border-l-2 border-destructive bg-muted/30 px-3 py-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{e.worker_id ?? "—"} · {e.kind} · {e.level}</span>
                    <span>{relTime(e.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs">{e.message}</p>
                </li>
              ))}
            </ul>}
        </CardContent>
      </Card>
    </div>
  );
}
