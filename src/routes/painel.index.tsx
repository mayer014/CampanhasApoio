import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, Users, Calendar, Copy, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

export const Route = createFileRoute("/painel/")({
  component: PainelHome,
});

type Lead = { neighborhood: string; street: string; created_at: string };
type Tpl = { name: string; generation_count: number };

const COLORS = ["hsl(var(--primary))", "#22c55e", "#f59e0b", "#3b82f6", "#ef4444", "#a855f7", "#06b6d4", "#ec4899"];

function PainelHome() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ templates: 0, leads: 0, generations: 0 });
  const [profile, setProfile] = useState<{ full_name: string; slug: string } | null>(null);
  const [sub, setSub] = useState<{ status: string; due_date: string | null; monthly_amount: number | null } | null>(null);
  const [settings, setSettings] = useState<{
    whatsapp_number: string | null;
    pix_key: string | null;
    pix_qr_url: string | null;
    pix_owner_name: string | null;
  } | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: prof }, { data: subData }, { data: settingsData }, { data: leadData }, { data: tplData }] = await Promise.all([
        supabase.from("candidate_profiles").select("full_name, slug").eq("id", user.id).single(),
        supabase.from("subscriptions").select("status, due_date, monthly_amount").eq("candidate_id", user.id).maybeSingle(),
        supabase.from("app_settings").select("whatsapp_number, pix_key, pix_qr_url, pix_owner_name").eq("id", 1).maybeSingle(),
        supabase.from("voter_leads").select("neighborhood, street, created_at").eq("candidate_id", user.id),
        supabase.from("templates").select("name, generation_count").eq("candidate_id", user.id),
      ]);
      setProfile(prof);
      setSub(subData);
      setSettings(settingsData);
      setLeads(leadData ?? []);
      setTpls(tplData ?? []);
      setStats({
        templates: tplData?.length ?? 0,
        leads: leadData?.length ?? 0,
        generations: (tplData ?? []).reduce((s, t) => s + (t.generation_count ?? 0), 0),
      });
    })();
  }, [user]);

  const byNeighborhood = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => {
      const k = l.neighborhood?.trim() || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [leads]);

  const topStreets = useMemo(() => {
    const m = new Map<string, number>();
    leads.forEach((l) => {
      const k = l.street?.trim() || "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [leads]);

  const byDay = useMemo(() => {
    const m = new Map<string, number>();
    const days = 14;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      m.set(d.toISOString().slice(0, 10), 0);
    }
    leads.forEach((l) => {
      const k = l.created_at.slice(0, 10);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
    });
    return Array.from(m, ([date, total]) => ({
      date: new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      total,
    }));
  }, [leads]);

  const tplData = useMemo(
    () => tpls.map((t) => ({ name: t.name.length > 16 ? t.name.slice(0, 16) + "…" : t.name, fotos: t.generation_count })),
    [tpls],
  );

  const copyPix = () => {
    if (!settings?.pix_key) return;
    navigator.clipboard.writeText(settings.pix_key);
    toast.success("Chave PIX copiada!");
  };

  const openWhats = (msg: string) => {
    if (!settings?.whatsapp_number) {
      toast.error("WhatsApp do administrador não configurado");
      return;
    }
    const url = `https://wa.me/${settings.whatsapp_number}?text=${encodeURIComponent(msg)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const valueLabel = sub?.monthly_amount ? `R$ ${Number(sub.monthly_amount).toFixed(2)}` : "a combinar";
  const dueLabel = sub?.due_date ? new Date(sub.due_date).toLocaleDateString("pt-BR") : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Olá, {profile?.full_name?.split(" ")[0] ?? "candidato"} 👋</h1>
        <p className="mt-1 text-muted-foreground">Visão geral da sua campanha.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground"><ImageIcon className="h-4 w-4" /> Templates</div>
          <div className="mt-2 text-3xl font-bold">{stats.templates}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground"><Users className="h-4 w-4" /> Eleitores</div>
          <div className="mt-2 text-3xl font-bold">{stats.leads}</div>
        </Card>
        <Card className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground"><Sparkles className="h-4 w-4" /> Fotos geradas</div>
          <div className="mt-2 text-3xl font-bold">{stats.generations}</div>
        </Card>
      </div>

      {/* Assinatura + Renovação */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Calendar className="h-4 w-4" /> Sua assinatura
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-3">
              <span className="text-2xl font-bold capitalize">{sub?.status ?? "—"}</span>
              <span className="text-lg font-semibold text-primary">{valueLabel}/mês</span>
              {dueLabel && <span className="text-sm text-muted-foreground">vence em {dueLabel}</span>}
            </div>
          </div>
          <Button
            size="lg"
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            onClick={() =>
              openWhats(
                `Olá! Quero renovar minha assinatura (${profile?.full_name ?? ""}) — valor ${valueLabel}.`,
              )
            }
          >
            <MessageCircle className="mr-2 h-4 w-4" /> RENOVAR ASSINATURA
          </Button>
        </div>

        {/* Área PIX */}
        <div className="mt-6 grid gap-6 rounded-lg border bg-card/50 p-5 md:grid-cols-[auto_1fr]">
          {settings?.pix_qr_url ? (
            <img
              src={settings.pix_qr_url}
              alt="QR Code PIX"
              loading="eager"
              referrerPolicy="no-referrer"
              onError={(e) => console.error("[PIX QR] falhou ao carregar", settings.pix_qr_url, e)}
              className="h-48 w-48 rounded-md border bg-white object-contain p-2"
            />
          ) : (
            <div className="flex h-48 w-48 items-center justify-center rounded-md border bg-muted text-center text-xs text-muted-foreground">
              {settings ? "QR PIX ainda não cadastrado pelo administrador" : "Carregando QR..."}
            </div>
          )}
          <div className="space-y-3">
            <div>
              <div className="text-sm font-semibold">Pague pelo PIX</div>
              <div className="text-xs text-muted-foreground">
                Escaneie o QR ou copie a chave abaixo. {settings?.pix_owner_name && `Titular: ${settings.pix_owner_name}.`}
              </div>
            </div>
            {settings?.pix_key && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Chave PIX</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 text-sm">{settings.pix_key}</code>
                  <Button variant="outline" size="sm" onClick={copyPix}>
                    <Copy className="mr-2 h-4 w-4" /> Copiar
                  </Button>
                </div>
              </div>
            )}
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              Após pagar, envie o comprovante no WhatsApp para liberarmos sua renovação.
            </div>
            <Button
              variant="outline"
              onClick={() =>
                openWhats(
                  `Olá! Acabei de pagar minha assinatura (${profile?.full_name ?? ""}). Segue o comprovante.`,
                )
              }
            >
              <MessageCircle className="mr-2 h-4 w-4" /> Enviar comprovante
            </Button>
          </div>
        </div>
      </Card>

      {/* Gráficos */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="font-semibold">Eleitores por bairro</h3>
          <p className="text-xs text-muted-foreground">Top 8 bairros</p>
          <div className="mt-4 h-64">
            {byNeighborhood.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byNeighborhood} dataKey="value" nameKey="name" outerRadius={90} label>
                    {byNeighborhood.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Cadastros nos últimos 14 dias</h3>
          <div className="mt-4 h-64">
            {leads.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <LineChart data={byDay}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="date" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Fotos geradas por template</h3>
          <div className="mt-4 h-64">
            {tplData.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <BarChart data={tplData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis allowDecimals={false} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="fotos" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Top ruas</h3>
          <div className="mt-4 h-64">
            {topStreets.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer>
                <BarChart data={topStreets} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis type="number" allowDecimals={false} fontSize={11} />
                  <YAxis type="category" dataKey="name" width={120} fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#22c55e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Sem dados ainda
    </div>
  );
}
