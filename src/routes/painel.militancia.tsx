import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  Users, Trophy, Target, MessageSquare, 
  TrendingUp, Star, Filter, Search,
  ArrowRight, Heart, Share2, Award,
  Clock, AlertCircle, Instagram, Facebook
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/painel/militancia")({
  component: MilitanciaPage,
});

type Militant = {
  id: string;
  author_name: string | null;
  platform: string;
  avatar_url: string | null;
  total_comments: number;
  total_positive: number;
  total_negative: number;
  current_badge: string | null;
  last_seen_at: string;
};

type Mission = {
  id: string;
  title: string;
  description: string;
  priority: string | null;
  status: string | null;
  created_at: string;
};

function MilitanciaPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [militants, setMilitants] = useState<Militant[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id]);

  async function load() {
    if (!user?.id) return;
    setLoading(true);
    const [militantsRes, missionsRes] = await Promise.all([
      supabase
        .from("social_militants")
        .select("*")
        .eq("user_id", user.id)
        .order("total_positive", { ascending: false })
        .limit(10),
      supabase
        .from("missions")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5)
    ]);

    if (militantsRes.error) toast.error("Erro ao carregar militantes");
    else setMilitants(militantsRes.data || []);

    if (missionsRes.error) toast.error("Erro ao carregar missões");
    else setMissions(missionsRes.data || []);

    setLoading(false);
  }

  return (
    <div className="space-y-8">
      {/* Header Estilizado */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-indigo-500/10 via-background to-background p-6 sm:p-8">
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-xl bg-indigo-500/15 p-3 text-indigo-600 dark:text-indigo-400">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Militância Digital</h1>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Monitore seus apoiadores mais ativos, identifique defensores da marca e organize missões de engajamento.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              <Trophy className="mr-1 h-3 w-3" /> Gamificação Ativa
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Coluna Principal: Militantes */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">Ranking de Engajamento</CardTitle>
                <CardDescription>Apoiadores identificados via IA nos comentários</CardDescription>
              </div>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" /> Filtrar
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : militants.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-muted p-4 mb-4">
                    <Users className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-semibold text-lg">Nenhum militante ainda</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Interaja mais nas redes sociais e deixe a IA identificar seus maiores apoiadores.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {militants.map((m, idx) => (
                    <div key={m.id} className="group relative flex items-center justify-between rounded-xl border p-4 transition-all hover:bg-muted/30">
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                          {idx + 1}º
                        </div>
                        <div className="relative">
                          {m.avatar_url ? (
                            <img src={m.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-background" />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground ring-2 ring-background">
                              <Users className="h-5 w-5" />
                            </div>
                          )}
                          {m.current_badge && (
                            <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-white shadow-sm ring-2 ring-background">
                              <Star className="h-3 w-3 fill-current" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-sm sm:text-base">{m.author_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1 uppercase">
                              {m.platform === 'instagram' ? <Instagram className="h-3 w-3" /> : <Facebook className="h-3 w-3" />}
                              {m.platform}
                            </span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Ativo {new Date(m.last_seen_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="hidden text-right sm:block">
                          <p className="text-sm font-bold text-indigo-600">{m.total_positive} Apoios</p>
                          <p className="text-[10px] text-muted-foreground">{m.total_comments} comentários totais</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="ghost" className="w-full text-xs text-muted-foreground hover:text-primary">
                    Ver ranking completo
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: Missões e Stats */}
        <div className="space-y-6">
          <Card className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Target className="h-5 w-5" /> Meta da Semana
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs mb-1 opacity-90">
                    <span>Engajamento Positivo</span>
                    <span>72%</span>
                  </div>
                  <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                    <div className="h-full bg-white rounded-full" style={{ width: '72%' }} />
                  </div>
                </div>
                <p className="text-xs opacity-80 leading-relaxed">
                  Sua militância está reagindo bem aos posts de educação. Foque em gerar 50 novos comentários positivos até sexta.
                </p>
                <Button variant="secondary" size="sm" className="w-full bg-white text-indigo-700 hover:bg-white/90">
                  Gerar Missão com IA
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-500" /> Missões Ativas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : missions.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-xs text-muted-foreground italic">Nenhuma missão sugerida.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {missions.map((mission) => (
                    <div key={mission.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold leading-tight">{mission.title}</p>
                        <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase">
                          {mission.priority}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {mission.description}
                      </p>
                      <Button variant="link" size="sm" className="h-auto p-0 text-indigo-600 text-xs">
                        Ativar Missão <ArrowRight className="ml-1 h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-indigo-500" /> Insights de Defesa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-xs">
                <div className="flex gap-3">
                  <div className="h-2 w-2 mt-1 rounded-full bg-destructive shrink-0" />
                  <p className="text-muted-foreground">
                    Detectamos uma onda de críticas no post de "Obras". Recomendamos acionar os 5 principais militantes para esclarecer os fatos.
                  </p>
                </div>
                <div className="flex gap-3">
                  <div className="h-2 w-2 mt-1 rounded-full bg-emerald-500 shrink-0" />
                  <p className="text-muted-foreground">
                    Apoiadores estão pedindo mais fotos com a comunidade. Use isso como pauta para o próximo template!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
