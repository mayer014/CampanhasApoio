import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Image as ImageIcon, Users, Calendar } from "lucide-react";

export const Route = createFileRoute("/painel/")({
  component: PainelHome,
});

function PainelHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ templates: 0, leads: 0, generations: 0 });
  const [profile, setProfile] = useState<{ full_name: string; slug: string } | null>(null);
  const [sub, setSub] = useState<{ status: string; due_date: string | null } | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: subData }, { count: tCount }, { count: lCount }, { data: tData }] = await Promise.all([
        supabase.from("candidate_profiles").select("full_name, slug").eq("id", user.id).single(),
        supabase.from("subscriptions").select("status, due_date").eq("candidate_id", user.id).maybeSingle(),
        supabase.from("templates").select("*", { count: "exact", head: true }).eq("candidate_id", user.id),
        supabase.from("voter_leads").select("*", { count: "exact", head: true }).eq("candidate_id", user.id),
        supabase.from("templates").select("generation_count").eq("candidate_id", user.id),
      ]);
      setProfile(prof);
      setSub(subData);
      setStats({
        templates: tCount ?? 0,
        leads: lCount ?? 0,
        generations: (tData ?? []).reduce((s, t) => s + (t.generation_count ?? 0), 0),
      });
    })();
  }, [user]);

  return (
    <div>
      <h1 className="text-3xl font-bold">Olá, {profile?.full_name?.split(" ")[0] ?? "candidato"} 👋</h1>
      <p className="mt-1 text-muted-foreground">Visão geral da sua campanha.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground"><ImageIcon className="h-4 w-4" /> Templates</div>
          <div className="mt-2 text-3xl font-bold">{stats.templates}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground"><Users className="h-4 w-4" /> Eleitores</div>
          <div className="mt-2 text-3xl font-bold">{stats.leads}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground"><ImageIcon className="h-4 w-4" /> Fotos geradas</div>
          <div className="mt-2 text-3xl font-bold">{stats.generations}</div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <div className="flex items-center gap-3 text-muted-foreground"><Calendar className="h-4 w-4" /> Assinatura</div>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-lg font-semibold capitalize">{sub?.status ?? "—"}</span>
          {sub?.due_date && <span className="text-sm text-muted-foreground">vence em {new Date(sub.due_date).toLocaleDateString("pt-BR")}</span>}
        </div>
      </Card>
    </div>
  );
}
