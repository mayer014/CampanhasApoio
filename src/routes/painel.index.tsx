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
  const [profile, setProfile] = useState<{ full_name: string; slug: string; is_blocked: boolean; trial_limit: number; signup_source: string } | null>(null);
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
      const [profRes, subRes, settingsRes, leadRes, tplRes] = await Promise.all([
        supabase.from("candidate_profiles").select("full_name, slug, is_blocked, trial_limit, signup_source").eq("id", user.id).single(),
        supabase.from("subscriptions").select("status, due_date, monthly_amount").eq("candidate_id", user.id).maybeSingle(),
        supabase.from("app_settings").select("whatsapp_number, pix_key, pix_qr_url, pix_owner_name").eq("id", 1).maybeSingle(),
        supabase.from("voter_leads").select("neighborhood, street, created_at").eq("candidate_id", user.id),
        supabase.from("templates").select("name, generation_count").eq("candidate_id", user.id),
      ]);
      console.log("[painel] app_settings result:", settingsRes);
      if (settingsRes.error) console.error("[painel] app_settings error:", settingsRes.error);
      setProfile(profRes.data);
      setSub(subRes.data);
      setSettings(settingsRes.data);
      setLeads(leadRes.data ?? []);
      setTpls(tplRes.data ?? []);
      setStats({
        templates: tplRes.data?.length ?? 0,
        leads: leadRes.data?.length ?? 0,
        generations: (tplRes.data ?? []).reduce((s, t) => s + (t.generation_count ?? 0), 0),
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

  const trialRemaining = Math.max(0, (profile?.trial_limit ?? 0) - stats.generations);
  const showTrialWarning =
    !!profile && profile.signup_source === "public" && !profile.is_blocked && trialRemaining > 0 && trialRemaining <= 2;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Olá, {profile?.full_name?.split(" ")[0] ?? "candidato"} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground sm:text-base">Visão geral da sua campanha.</p>
      </div>

      {profile?.is_blocked && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 sm:p-6">
          <h2 className="text-lg font-bold text-destructive sm:text-xl">Seu trial gratuito acabou</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Você usou suas {profile.trial_limit} fotos grátis. Para continuar gerando fotos, faça o pagamento via PIX abaixo
            e envie o comprovante pelo WhatsApp. Assim que o administrador confirmar, seu acesso é liberado na hora.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {settings?.pix_key && (
              <Button onClick={copyPix} variant="outline">
                <Copy className="mr-2 h-4 w-4" /> Copiar chave PIX
              </Button>
            )}
            <Button
              onClick={() =>
                openWhats(
                  `Olá! Acabei de fazer o pagamento para liberar minha conta (${profile.full_name}). Segue o comprovante.`,
                )
              }
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <MessageCircle className="mr-2 h-4 w-4" /> Enviar comprovante no WhatsApp
            </Button>
          </div>
        </Card>
      )}

      {showTrialWarning && (
        <Card className="border-yellow-500/40 bg-yellow-500/5 p-4">
          <p className="text-sm">
            <strong>Restam {trialRemaining} {trialRemaining === 1 ? "foto grátis" : "fotos grátis"}.</strong>{" "}
            Antes de bloquear, garanta o pagamento via PIX para continuar usando sem interrupção.
          </p>
        </Card>
      )}

      <div className="grid gap-3 grid-cols-3 md:gap-4">
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:gap-3 sm:text-sm"><ImageIcon className="h-4 w-4 shrink-0" /><span className="truncate">Templates</span></div>
          <div className="mt-2 text-2xl font-bold sm:text-3xl">{stats.templates}</div>
        </Card>
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:gap-3 sm:text-sm"><Users className="h-4 w-4 shrink-0" /><span className="truncate">Eleitores</span></div>
          <div className="mt-2 text-2xl font-bold sm:text-3xl">{stats.leads}</div>
        </Card>
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground sm:gap-3 sm:text-sm"><Sparkles className="h-4 w-4 shrink-0" /><span className="truncate">Fotos</span></div>
          <div className="mt-2 text-2xl font-bold sm:text-3xl">{stats.generations}</div>
        </Card>
      </div>

      {/* Assinatura + Renovação */}
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" /> Sua assinatura
            </div>
            <div className="mt-2 flex flex-wrap items-baseline gap-2 sm:gap-3">
              <span className="text-xl font-bold capitalize sm:text-2xl">{sub?.status ?? "—"}</span>
              <span className="text-base font-semibold text-primary sm:text-lg">{valueLabel}/mês</span>
              {dueLabel && <span className="text-xs text-muted-foreground sm:text-sm">vence em {dueLabel}</span>}
            </div>
          </div>
          <Button
            size="lg"
            className="w-full bg-emerald-600 text-white hover:bg-emerald-700 sm:w-auto"
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
        <div className="mt-6 flex flex-col gap-6 rounded-lg border bg-card/50 p-4 sm:p-5 md:flex-row md:items-start">
          <div className="mx-auto flex aspect-square w-full max-w-[192px] items-center justify-center overflow-hidden rounded-md border bg-white p-2 md:mx-0 md:shrink-0">
            {settings?.pix_qr_url ? (
              <img
                key={settings.pix_qr_url}
                src={settings.pix_qr_url}
                alt="QR Code PIX"
                loading="eager"
                referrerPolicy="no-referrer"
                onError={(e) => console.error("[PIX QR] falhou ao carregar", settings.pix_qr_url, e)}
                className="block h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-muted text-center text-xs text-muted-foreground">
                {settings ? "QR PIX ainda não cadastrado pelo administrador" : "Carregando QR..."}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <div className="text-sm font-semibold">Pague pelo PIX</div>
              <div className="text-xs text-muted-foreground">
                Escaneie o QR ou copie a chave abaixo. {settings?.pix_owner_name && `Titular: ${settings.pix_owner_name}.`}
              </div>
            </div>
            {settings?.pix_key && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Chave PIX</div>
                <div className="mt-1 space-y-2">
                  <code className="block w-full overflow-hidden whitespace-pre-wrap break-all rounded-md bg-muted px-3 py-2 text-sm">{settings.pix_key}</code>
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
        <Card className="p-4 sm:p-6">
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

        <Card className="p-4 sm:p-6">
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

        <Card className="p-4 sm:p-6">
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

        <Card className="p-4 sm:p-6">
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
