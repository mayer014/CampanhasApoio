import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listSocialProfiles,
  createSocialProfile,
  toggleSocialProfile,
  deleteSocialProfile,
} from "@/lib/social.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, RefreshCw, Instagram, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { withSocialAuth, getSocialErrorMessage as getSocialClientErrorMessage } from "@/lib/social-client";

function readableError(error: unknown): string {
  const socialMessage = getSocialClientErrorMessage(error);
  if (socialMessage) return socialMessage;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  return "Erro na inteligência social";
}

type Profile = {
  id: string;
  username: string;
  profile_type: "own_profile" | "competitor" | "portal" | "influencer";
  display_name: string | null;
  followers_count: number | null;
  is_active: boolean;
  check_interval_minutes: number;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_errors: number;
};

const TYPE_LABEL: Record<Profile["profile_type"], string> = {
  own_profile: "Próprio",
  competitor: "Concorrente",
  portal: "Portal",
  influencer: "Influenciador",
};

const TYPE_VARIANT: Record<Profile["profile_type"], "default" | "secondary" | "outline" | "destructive"> = {
  own_profile: "default",
  competitor: "destructive",
  portal: "secondary",
  influencer: "outline",
};

function timeAgo(iso: string | null) {
  if (!iso) return "nunca";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
}

export function SocialProfilesPanel({ ready }: { ready: boolean }) {
  const list = useServerFn(listSocialProfiles);
  const create = useServerFn(createSocialProfile);
  const toggle = useServerFn(toggleSocialProfile);
  const del = useServerFn(deleteSocialProfile);

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [username, setUsername] = useState("");
  const [profileType, setProfileType] = useState<Profile["profile_type"]>("competitor");
  const [interval, setInterval] = useState(360);

  const refresh = async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const r: any = await withSocialAuth((options) => list({ data: {}, ...options }));
      if (r?.ok === false) throw new Error(r?.message || "Erro ao carregar perfis");
      setProfiles((r?.profiles ?? []) as Profile[]);
    } catch (e) {
      toast.error(readableError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    try {
      const result: any = await withSocialAuth((options) =>
        create({
          data: {
            username: username.trim().replace(/^@/, ""),
            profile_type: profileType,
            check_interval_minutes: interval,
          },
          ...options,
        }),
      );
      if (result?.ok === false) throw new Error(result?.message || "Erro ao adicionar");
      toast.success("Perfil adicionado ao monitoramento");
      setUsername("");
      await refresh();
    } catch (e) {
      toast.error(readableError(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (p: Profile, val: boolean) => {
    if (!ready) return;
    try {
      const result: any = await withSocialAuth((options) =>
        toggle({ data: { profile_id: p.id, is_active: val }, ...options }),
      );
      if (result?.ok === false) throw new Error(result?.message || "Erro ao atualizar perfil");
      setProfiles((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: val } : x)));
    } catch (e) {
      toast.error(readableError(e));
    }
  };

  const handleDelete = async (p: Profile) => {
    if (!ready) return;
    if (!confirm(`Remover @${p.username} do monitoramento?`)) return;
    try {
      const result: any = await withSocialAuth((options) =>
        del({ data: { profile_id: p.id }, ...options }),
      );
      if (result?.ok === false) throw new Error(result?.message || "Erro ao remover perfil");
      setProfiles((prev) => prev.filter((x) => x.id !== p.id));
      toast.success("Removido");
    } catch (e) {
      toast.error(readableError(e));
    }
  };

  if (!ready) return <p className="text-muted-foreground">Carregando sessão…</p>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar perfil Instagram</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-[1fr_180px_160px_auto] sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="ig-user">Username</Label>
              <div className="relative">
                <Instagram className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="ig-user"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex.: lulaoficial"
                  className="pl-8"
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={profileType} onValueChange={(v) => setProfileType(v as Profile["profile_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="own_profile">Próprio</SelectItem>
                  <SelectItem value="competitor">Concorrente</SelectItem>
                  <SelectItem value="portal">Portal de notícias</SelectItem>
                  <SelectItem value="influencer">Influenciador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Intervalo (min)</Label>
              <Input
                type="number"
                min={30}
                max={10080}
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value) || 360)}
              />
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Adicionando…" : "Adicionar"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Perfis monitorados ({profiles.length})</CardTitle>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </CardHeader>
        <CardContent>
          {profiles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhum perfil cadastrado ainda. Adicione o primeiro acima.
            </p>
          ) : (
            <div className="divide-y">
              {profiles.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">@{p.username}</span>
                      <Badge variant={TYPE_VARIANT[p.profile_type]}>{TYPE_LABEL[p.profile_type]}</Badge>
                      {p.followers_count != null && (
                        <span className="text-xs text-muted-foreground">
                          {p.followers_count.toLocaleString("pt-BR")} seguidores
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> a cada {p.check_interval_minutes}min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        {p.last_error ? (
                          <AlertTriangle className="h-3 w-3 text-destructive" />
                        ) : (
                          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        )}
                        último check: {timeAgo(p.last_checked_at)}
                      </span>
                      {p.consecutive_errors > 0 && (
                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                          {p.consecutive_errors} erro(s)
                        </Badge>
                      )}
                    </div>
                    {p.last_error && (
                      <div className="mt-1 truncate text-xs text-destructive" title={p.last_error}>
                        {p.last_error}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={p.is_active}
                        onCheckedChange={(v) => handleToggle(p, v)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {p.is_active ? "Ativo" : "Pausado"}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(p)}
                      aria-label="Remover"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
