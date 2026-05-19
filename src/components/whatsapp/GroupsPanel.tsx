import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Star, RefreshCw, Loader2, Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { syncChats, toggleGroupFavorite } from "@/lib/whatsapp.functions";

type Group = {
  id: string;
  jid: string;
  name: string | null;
  participants_count: number | null;
  is_favorite: boolean;
  is_admin: boolean;
  last_message_at: string | null;
};

export function GroupsPanel({
  accessToken,
  candidateId,
}: {
  accessToken: string | null;
  candidateId: string;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [favOnly, setFavOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_groups")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("is_favorite", { ascending: false })
      .order("name", { ascending: true });
    setGroups((data || []) as any);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, [candidateId]);

  const onSync = async () => {
    if (!accessToken) return;
    setSyncing(true);
    try {
      await syncChats({
        data: { access_token: accessToken, candidate_id: candidateId },
      });
      toast.success("Grupos sincronizados");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setSyncing(false);
    }
  };

  const toggleFav = async (g: Group) => {
    if (!accessToken) return;
    try {
      const res = await toggleGroupFavorite({
        data: {
          access_token: accessToken,
          candidate_id: candidateId,
          group_id: g.id,
        },
      });
      setGroups((prev) =>
        prev.map((x) => (x.id === g.id ? { ...x, is_favorite: res.is_favorite } : x))
      );
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  };

  const filtered = groups.filter((g) => {
    if (favOnly && !g.is_favorite) return false;
    if (search && !(g.name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar grupo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={favOnly ? "default" : "outline"}
            onClick={() => setFavOnly((v) => !v)}
          >
            <Star className={`mr-2 h-4 w-4 ${favOnly ? "fill-current" : ""}`} />
            Favoritos
          </Button>
          <Button onClick={onSync} disabled={syncing}>
            {syncing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Sincronizar
          </Button>
        </div>
      </div>

      {loading ? (
        <Card className="p-6 text-center">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" />
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          Nenhum grupo. Sincronize ou entre em algum grupo no WhatsApp.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((g) => (
            <Card key={g.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">
                      {g.name || g.jid}
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      {g.participants_count != null && (
                        <span>{g.participants_count} membros</span>
                      )}
                      {g.is_admin && <Badge variant="secondary">Admin</Badge>}
                    </div>
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={() => toggleFav(g)}>
                  <Star
                    className={`h-4 w-4 ${
                      g.is_favorite ? "fill-yellow-400 text-yellow-400" : ""
                    }`}
                  />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
