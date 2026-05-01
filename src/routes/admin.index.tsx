import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, AlertTriangle, Image as ImageIcon, UserPlus } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

type CandidateRow = {
  id: string;
  name: string;
  fotos: number;
  eleitores: number;
  limite: number;
  uso_pct: number;
  is_blocked: boolean;
};

function AdminHome() {
  const [stats, setStats] = useState({ candidates: 0, blocked: 0, generations: 0, leads: 0, dueSoon: 0 });
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [dueSoon, setDueSoon] = useState<{ candidate_id: string; due_date: string; full_name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: cands }, { data: tpls }, { data: leads }, { data: subs }] = await Promise.all([
        supabase.from("candidate_profiles").select("id, full_name, is_blocked, trial_limit"),
        supabase.from("templates").select("candidate_id, generation_count"),
        supabase.from("voter_leads").select("candidate_id"),
        supabase.from("subscriptions").select("candidate_id, due_date"),
      ]);

      const fotosByCand: Record<string, number> = {};
      (tpls ?? []).forEach((t: any) => {
        fotosByCand[t.candidate_id] = (fotosByCand[t.candidate_id] ?? 0) + (t.generation_count ?? 0);
      });
      const leadsByCand: Record<string, number> = {};
      (leads ?? []).forEach((l: any) => {
        leadsByCand[l.candidate_id] = (leadsByCand[l.candidate_id] ?? 0) + 1;
      });

      const candidateRows: CandidateRow[] = (cands ?? []).map((c: any) => {
        const fotos = fotosByCand[c.id] ?? 0;
        const limite = c.trial_limit ?? 0;
        return {
          id: c.id,
          name: c.full_name,
          fotos,
          eleitores: leadsByCand[c.id] ?? 0,
          limite,
          uso_pct: limite > 0 ? Math.min(100, Math.round((fotos / limite) * 100)) : 0,
          is_blocked: c.is_blocked,
        };
      }).sort((a, b) => b.fotos - a.fotos);

      const today = new Date();
      const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dueIds = (subs ?? []).filter((s): s is { candidate_id: string; due_date: string } => !!s.due_date && new Date(s.due_date) <= in7);
      const profMap = new Map((cands ?? []).map((c: any) => [c.id, c.full_name]));
      const enriched = dueIds.map((d) => ({ ...d, full_name: (profMap.get(d.candidate_id) as string) ?? "—" }));

      setRows(candidateRows);
      setStats({
        candidates: cands?.length ?? 0,
        blocked: (cands ?? []).filter((c: any) => c.is_blocked).length,
        generations: candidateRows.reduce((s, r) => s + r.fotos, 0),
        leads: leads?.length ?? 0,
        dueSoon: dueIds.length,
      });
      setDueSoon(enriched);
    })();
  }, []);

  const topFotos = rows.slice(0, 10);
  const topLeads = [...rows].sort((a, b) => b.eleitores - a.eleitores).slice(0, 10);

  return (
    <div>
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-1 text-muted-foreground">Uso da plataforma por candidato.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Candidatos" value={stats.candidates} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Bloqueados" value={stats.blocked} />
        <StatCard icon={<ImageIcon className="h-4 w-4" />} label="Fotos geradas" value={stats.generations} />
        <StatCard icon={<UserPlus className="h-4 w-4" />} label="Eleitores captados" value={stats.leads} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold">Top candidatos · Fotos geradas</h2>
          <p className="text-sm text-muted-foreground">10 candidatos com mais fotos geradas.</p>
          <div className="mt-4 h-72">
            {topFotos.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topFotos} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + "…" : v)} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="fotos" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Top candidatos · Eleitores captados</h2>
          <p className="text-sm text-muted-foreground">10 candidatos com mais leads cadastrados.</p>
          <div className="mt-4 h-72">
            {topLeads.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topLeads} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v: string) => (v.length > 16 ? v.slice(0, 16) + "…" : v)} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="eleitores" fill="hsl(var(--accent-foreground))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold">Uso do limite de fotos por candidato</h2>
        <p className="text-sm text-muted-foreground">Quanto cada candidato já consumiu do seu limite de fotos grátis (%).</p>
        <div className="mt-4" style={{ height: Math.max(280, rows.length * 32) }}>
          {rows.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} layout="vertical" margin={{ left: 12, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} unit="%" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis dataKey="name" type="category" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 18) + "…" : v)} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                  formatter={(_v, _n, p: any) => [`${p.payload.fotos}/${p.payload.limite} fotos (${p.payload.uso_pct}%)`, "Uso"]}
                />
                <Bar dataKey="uso_pct" radius={[0, 6, 6, 0]}>
                  {rows.map((r) => (
                    <Cell
                      key={r.id}
                      fill={
                        r.is_blocked || r.uso_pct >= 100
                          ? "hsl(var(--destructive))"
                          : r.uso_pct >= 80
                            ? "hsl(38 92% 50%)"
                            : "hsl(var(--primary))"
                      }
                    />
                  ))}
                </Bar>
                <Legend
                  verticalAlign="top"
                  content={() => (
                    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" /> Em uso</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: "hsl(38 92% 50%)" }} /> Próximo do limite (≥80%)</span>
                      <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-destructive" /> Limite atingido / bloqueado</span>
                    </div>
                  )}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

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

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </Card>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>;
}
