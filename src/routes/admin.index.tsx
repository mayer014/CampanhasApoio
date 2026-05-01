import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Users, AlertTriangle, Image as ImageIcon, UserPlus, Globe, Clock, CheckCircle2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

type Candidate = {
  id: string;
  full_name: string;
  is_blocked: boolean;
  trial_limit: number;
  signup_source: string;
  city: string | null;
  state: string | null;
  created_at: string;
  unblocked_at: string | null;
};

type CandidateRow = {
  id: string;
  name: string;
  fotos: number;
  eleitores: number;
  limite: number;
  uso_pct: number;
  is_blocked: boolean;
  signup_source: string;
};

function AdminHome() {
  const [stats, setStats] = useState({
    candidates: 0,
    blocked: 0,
    generations: 0,
    leads: 0,
    dueSoon: 0,
    publicSignups: 0,
    awaiting: 0,
    converted: 0,
  });
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [cands, setCands] = useState<Candidate[]>([]);
  const [fotosByCand, setFotosByCand] = useState<Record<string, number>>({});
  const [activeSubIds, setActiveSubIds] = useState<Set<string>>(new Set());
  const [dueSoon, setDueSoon] = useState<{ candidate_id: string; due_date: string; full_name: string }[]>([]);

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: tpls }, { data: leads }, { data: subs }] = await Promise.all([
        supabase
          .from("candidate_profiles")
          .select("id, full_name, is_blocked, trial_limit, signup_source, city, state, created_at, unblocked_at"),
        supabase.from("templates").select("candidate_id, generation_count"),
        supabase.from("voter_leads").select("candidate_id"),
        supabase.from("subscriptions").select("candidate_id, due_date, status"),
      ]);

      const fotosMap: Record<string, number> = {};
      (tpls ?? []).forEach((t: any) => {
        fotosMap[t.candidate_id] = (fotosMap[t.candidate_id] ?? 0) + (t.generation_count ?? 0);
      });
      const leadsByCand: Record<string, number> = {};
      (leads ?? []).forEach((l: any) => {
        leadsByCand[l.candidate_id] = (leadsByCand[l.candidate_id] ?? 0) + 1;
      });

      const candidates = (c ?? []) as Candidate[];
      const activeIds = new Set(
        (subs ?? []).filter((s: any) => s.status === "active").map((s: any) => s.candidate_id),
      );

      const candidateRows: CandidateRow[] = candidates
        .map((cp) => {
          const fotos = fotosMap[cp.id] ?? 0;
          const limite = cp.trial_limit ?? 0;
          return {
            id: cp.id,
            name: cp.full_name,
            fotos,
            eleitores: leadsByCand[cp.id] ?? 0,
            limite,
            uso_pct: limite > 0 ? Math.min(100, Math.round((fotos / limite) * 100)) : 0,
            is_blocked: cp.is_blocked,
            signup_source: cp.signup_source,
          };
        })
        .sort((a, b) => b.fotos - a.fotos);

      const today = new Date();
      const in7 = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      const dueIds = (subs ?? []).filter(
        (s): s is { candidate_id: string; due_date: string; status: string } =>
          !!s.due_date && new Date(s.due_date) <= in7,
      );
      const profMap = new Map(candidates.map((c) => [c.id, c.full_name]));
      const enriched = dueIds.map((d) => ({
        candidate_id: d.candidate_id,
        due_date: d.due_date,
        full_name: (profMap.get(d.candidate_id) as string) ?? "—",
      }));

      const publicCands = candidates.filter((c) => c.signup_source === "public");
      const awaiting = publicCands.filter((c) => c.is_blocked && !activeIds.has(c.id));
      const converted = publicCands.filter((c) => c.unblocked_at);

      setRows(candidateRows);
      setCands(candidates);
      setFotosByCand(fotosMap);
      setActiveSubIds(activeIds);
      setStats({
        candidates: candidates.length,
        blocked: candidates.filter((c) => c.is_blocked).length,
        generations: candidateRows.reduce((s, r) => s + r.fotos, 0),
        leads: leads?.length ?? 0,
        dueSoon: dueIds.length,
        publicSignups: publicCands.length,
        awaiting: awaiting.length,
        converted: converted.length,
      });
      setDueSoon(enriched);
    })();
  }, []);

  const topFotos = rows.slice(0, 10);
  const topLeads = [...rows].sort((a, b) => b.eleitores - a.eleitores).slice(0, 10);

  // Cadastros por dia (últimos 30 dias) — separa público vs admin
  const signupsByDay = useMemo(() => {
    const days = 30;
    const map = new Map<string, { date: string; publico: number; admin: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      map.set(k, { date: k, publico: 0, admin: 0 });
    }
    cands.forEach((c) => {
      const k = c.created_at.slice(0, 10);
      const slot = map.get(k);
      if (!slot) return;
      if (c.signup_source === "public") slot.publico += 1;
      else slot.admin += 1;
    });
    return Array.from(map.values()).map((r) => ({
      ...r,
      label: new Date(r.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
    }));
  }, [cands]);

  // Distribuição por UF (Top 10)
  const byState = useMemo(() => {
    const m = new Map<string, number>();
    cands.forEach((c) => {
      const k = c.state || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m, ([uf, total]) => ({ uf, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [cands]);

  // Funil do trial (apenas cadastros públicos)
  const funnel = useMemo(() => {
    const pub = cands.filter((c) => c.signup_source === "public");
    const cadastrados = pub.length;
    const geraram = pub.filter((c) => (fotosByCand[c.id] ?? 0) >= 1).length;
    const esgotaram = pub.filter((c) => (fotosByCand[c.id] ?? 0) >= (c.trial_limit ?? 0) && (c.trial_limit ?? 0) > 0).length;
    const pagaram = pub.filter((c) => !!c.unblocked_at).length;
    return [
      { etapa: "Cadastrados", total: cadastrados },
      { etapa: "Geraram ≥1 foto", total: geraram },
      { etapa: "Esgotaram trial", total: esgotaram },
      { etapa: "Liberados (pagaram)", total: pagaram },
    ];
  }, [cands, fotosByCand]);

  const awaitingList = useMemo(
    () =>
      cands
        .filter((c) => c.signup_source === "public" && c.is_blocked && !activeSubIds.has(c.id))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .slice(0, 10),
    [cands, activeSubIds],
  );

  return (
    <div>
      <h1 className="text-2xl font-bold sm:text-3xl">Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground sm:text-base">Uso da plataforma por candidato.</p>

      <div className="mt-6 grid gap-3 grid-cols-2 md:mt-8 md:gap-4 md:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Candidatos" value={stats.candidates} />
        <StatCard icon={<AlertTriangle className="h-4 w-4" />} label="Bloqueados" value={stats.blocked} />
        <StatCard icon={<ImageIcon className="h-4 w-4" />} label="Fotos geradas" value={stats.generations} />
        <StatCard icon={<UserPlus className="h-4 w-4" />} label="Eleitores captados" value={stats.leads} />
      </div>

      <div className="mt-3 grid gap-3 grid-cols-1 sm:grid-cols-3 md:mt-4 md:gap-4">
        <StatCard icon={<Globe className="h-4 w-4" />} label="Cadastros públicos" value={stats.publicSignups} />
        <StatCard icon={<Clock className="h-4 w-4" />} label="Aguardando liberação" value={stats.awaiting} highlight={stats.awaiting > 0} />
        <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Convertidos (pagaram)" value={stats.converted} />
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold">Cadastros nos últimos 30 dias</h2>
        <p className="text-sm text-muted-foreground">Comparação entre cadastros públicos e criados pelo admin.</p>
        <div className="mt-4 h-72">
          {signupsByDay.length === 0 ? (
            <Empty />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={signupsByDay} margin={{ left: 8, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="publico" name="Públicos" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="admin" name="Admin" stroke="hsl(38 92% 50%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold">Funil do trial (cadastros públicos)</h2>
          <p className="text-sm text-muted-foreground">Quantos avançam em cada etapa.</p>
          <div className="mt-4 h-72">
            {funnel[0].total === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnel} layout="vertical" margin={{ left: 12, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis dataKey="etapa" type="category" width={160} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Distribuição por estado (UF)</h2>
          <p className="text-sm text-muted-foreground">Top 10 estados com mais candidatos.</p>
          <div className="mt-4 h-72">
            {byState.length === 0 ? (
              <Empty />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byState} margin={{ left: 8, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="uf" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis allowDecimals={false} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {awaitingList.length > 0 && (
        <Card className="mt-6 border-yellow-500/30 bg-yellow-500/5 p-6">
          <h2 className="font-semibold">Aguardando liberação</h2>
          <p className="text-sm text-muted-foreground">Cadastros públicos que esgotaram o trial e ainda não foram liberados.</p>
          <ul className="mt-3 divide-y">
            {awaitingList.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div>
                  <div className="font-medium">{c.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.city ? `${c.city}/${c.state ?? "—"} · ` : ""}
                    cadastrou em {new Date(c.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </div>
                <Link to="/admin/candidatos/$id" params={{ id: c.id }} className="shrink-0 text-primary hover:underline">
                  Gerenciar
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

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

function StatCard({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={`p-6 ${highlight ? "border-yellow-500/40 bg-yellow-500/5" : ""}`}>
      <div className="flex items-center gap-2 text-muted-foreground">{icon}{label}</div>
      <div className="mt-2 text-3xl font-bold">{value}</div>
    </Card>
  );
}

function Empty() {
  return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Sem dados ainda</div>;
}
