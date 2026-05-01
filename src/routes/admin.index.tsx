import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useServerFn } from "@tanstack/react-start";
import { bootstrapAdmin } from "@/server/admin.functions";
import { useAuth } from "@/hooks/use-auth";
import { Users, AlertTriangle, Image as ImageIcon, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({ candidates: 0, blocked: 0, generations: 0, dueSoon: 0 });
  const [dueSoon, setDueSoon] = useState<{ candidate_id: string; due_date: string; full_name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ count: cTotal }, { count: cBlocked }, { data: tData }, { data: subs }] = await Promise.all([
        supabase.from("candidate_profiles").select("*", { count: "exact", head: true }),
        supabase.from("candidate_profiles").select("*", { count: "exact", head: true }).eq("is_blocked", true),
        supabase.from("templates").select("generation_count"),
        supabase.from("subscriptions").select("candidate_id, due_date"),
      ]);

      const generations = (tData ?? []).reduce((s, t) => s + (t.generation_count ?? 0), 0);

      const today = new Date();
      const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dueIds = (subs ?? []).filter((s): s is { candidate_id: string; due_date: string } => !!s.due_date && new Date(s.due_date) <= in7);
      const ids = dueIds.map((d) => d.candidate_id);
      const profiles = ids.length
        ? (await supabase.from("candidate_profiles").select("id, full_name").in("id", ids)).data ?? []
        : [];
      const enriched = dueIds.map((d) => ({
        ...d,
        full_name: profiles.find((p) => p.id === d.candidate_id)?.full_name ?? "—",
      }));

      setStats({ candidates: cTotal ?? 0, blocked: cBlocked ?? 0, generations, dueSoon: dueIds.length });
      setDueSoon(enriched);
    })();
  }, []);

  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Visão geral da plataforma.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground"><Users className="h-4 w-4" />Candidatos</div>
          <div className="mt-2 text-3xl font-bold">{stats.candidates}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4" />Bloqueados</div>
          <div className="mt-2 text-3xl font-bold">{stats.blocked}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground"><ImageIcon className="h-4 w-4" />Fotos geradas</div>
          <div className="mt-2 text-3xl font-bold">{stats.generations}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground"><AlertTriangle className="h-4 w-4" />Vencendo (7d)</div>
          <div className="mt-2 text-3xl font-bold">{stats.dueSoon}</div>
        </Card>
      </div>

      {dueSoon.length > 0 && (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold">Assinaturas vencendo nos próximos 7 dias</h2>
          <ul className="mt-3 divide-y">
            {dueSoon.map((d) => (
              <li key={d.candidate_id} className="flex items-center justify-between py-2 text-sm">
                <span>{d.full_name}</span>
                <Link to="/admin/candidatos/$id" params={{ id: d.candidate_id }} className="text-primary hover:underline">
                  Vence em {new Date(d.due_date).toLocaleDateString("pt-BR")}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
