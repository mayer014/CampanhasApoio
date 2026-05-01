import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

type Profile = {
  id: string; full_name: string; email: string | null; phone: string | null;
  slug: string; is_blocked: boolean; notes: string | null;
};

type Sub = { status: string; due_date: string | null; monthly_amount: number | null };
type Pay = { id: string; amount: number; paid_at: string; method: string | null; notes: string | null };
type Tpl = { id: string; name: string; is_active: boolean; generation_count: number };
type Lead = { id: string; full_name: string; phone: string; street: string; number: string; neighborhood: string; created_at: string };

export const Route = createFileRoute("/admin/candidatos/$id")({
  component: CandidateDetail,
});

function CandidateDetail() {
  const { id } = Route.useParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [pays, setPays] = useState<Pay[]>([]);
  const [tpls, setTpls] = useState<Tpl[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const load = async () => {
    const [{ data: p }, { data: s }, { data: pys }, { data: ts }, { data: ls }] = await Promise.all([
      supabase.from("candidate_profiles").select("*").eq("id", id).single(),
      supabase.from("subscriptions").select("status, due_date, monthly_amount").eq("candidate_id", id).maybeSingle(),
      supabase.from("payments").select("*").eq("candidate_id", id).order("paid_at", { ascending: false }),
      supabase.from("templates").select("id, name, is_active, generation_count").eq("candidate_id", id).order("created_at", { ascending: false }),
      supabase.from("voter_leads").select("*").eq("candidate_id", id).order("created_at", { ascending: false }),
    ]);
    setProfile(p);
    setSub(s);
    setPays(pys ?? []);
    setTpls(ts ?? []);
    setLeads(ls ?? []);
  };
  useEffect(() => { load(); }, [id]);

  if (!profile) return <div className="text-muted-foreground">Carregando…</div>;

  const saveProfile = async () => {
    const { error } = await supabase.from("candidate_profiles").update({
      full_name: profile.full_name, phone: profile.phone, notes: profile.notes, is_blocked: profile.is_blocked,
    }).eq("id", id);
    if (error) toast.error(error.message); else toast.success("Salvo");
  };

  const saveSub = async () => {
    const payload = { candidate_id: id, status: sub?.status ?? "active", due_date: sub?.due_date || null, monthly_amount: sub?.monthly_amount ?? null };
    const { error } = await supabase.from("subscriptions").upsert(payload, { onConflict: "candidate_id" });
    if (error) toast.error(error.message); else { toast.success("Assinatura atualizada"); load(); }
  };

  return (
    <div>
      <Link to="/admin/candidatos" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar</Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">{profile.full_name}</h1>
          <p className="text-sm text-muted-foreground">{profile.email} · /p/{profile.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Bloqueado</span>
          <Switch checked={profile.is_blocked} onCheckedChange={async (v) => { setProfile({ ...profile, is_blocked: v }); await supabase.from("candidate_profiles").update({ is_blocked: v }).eq("id", id); toast.success(v ? "Candidato bloqueado" : "Candidato liberado"); }} />
        </div>
      </div>

      <Tabs defaultValue="dados" className="mt-6">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="templates">Templates ({tpls.length})</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="leads">Eleitores ({leads.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card className="space-y-3 p-6">
            <div><Label>Nome</Label><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={profile.phone ?? ""} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
            <div><Label>Observações (CRM)</Label><Textarea value={profile.notes ?? ""} onChange={(e) => setProfile({ ...profile, notes: e.target.value })} /></div>
            <Button onClick={saveProfile}>Salvar</Button>
          </Card>
        </TabsContent>

        <TabsContent value="templates">
          <div className="mb-3 flex justify-end">
            <Link to="/admin/candidatos/$id/template/$tplId" params={{ id, tplId: "novo" }}>
              <Button><Plus className="mr-2 h-4 w-4" /> Novo template</Button>
            </Link>
          </div>
          <div className="grid gap-3">
            {tpls.map((t) => (
              <Card key={t.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-semibold">{t.name} {t.is_active && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Ativo</span>}</div>
                  <div className="text-sm text-muted-foreground">{t.generation_count} fotos geradas</div>
                </div>
                <Link to="/admin/candidatos/$id/template/$tplId" params={{ id, tplId: t.id }}>
                  <Button variant="outline">Editar</Button>
                </Link>
              </Card>
            ))}
            {tpls.length === 0 && <Card className="p-6 text-center text-muted-foreground">Nenhum template ainda</Card>}
          </div>
        </TabsContent>

        <TabsContent value="financeiro">
          <Card className="space-y-3 p-6">
            <h3 className="font-semibold">Assinatura</h3>
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <Label>Status</Label>
                <select className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm" value={sub?.status ?? "active"} onChange={(e) => setSub({ ...(sub ?? { due_date: null, monthly_amount: null }), status: e.target.value })}>
                  <option value="active">Ativa</option>
                  <option value="overdue">Vencida</option>
                  <option value="cancelled">Cancelada</option>
                </select>
              </div>
              <div><Label>Vencimento</Label><Input type="date" value={sub?.due_date ?? ""} onChange={(e) => setSub({ ...(sub ?? { status: "active", monthly_amount: null }), due_date: e.target.value })} /></div>
              <div><Label>Valor mensal</Label><Input type="number" step="0.01" value={sub?.monthly_amount ?? ""} onChange={(e) => setSub({ ...(sub ?? { status: "active", due_date: null }), monthly_amount: parseFloat(e.target.value) || null })} /></div>
            </div>
            <Button onClick={saveSub}>Salvar assinatura</Button>
          </Card>

          <PaymentsCard candidateId={id} payments={pays} onChange={load} />
        </TabsContent>

        <TabsContent value="leads">
          <Card className="overflow-hidden">
            <div className="divide-y">
              {leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-4 text-sm">
                  <div>
                    <div className="font-medium">{l.full_name} · {l.phone}</div>
                    <div className="text-muted-foreground">{l.street}, {l.number} — {l.neighborhood}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{new Date(l.created_at).toLocaleString("pt-BR")}</span>
                </div>
              ))}
              {leads.length === 0 && <div className="p-6 text-center text-muted-foreground">Nenhum eleitor ainda</div>}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PaymentsCard({ candidateId, payments, onChange }: { candidateId: string; payments: Pay[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", paid_at: new Date().toISOString().slice(0, 10), method: "", notes: "" });

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("payments").insert({
      candidate_id: candidateId,
      amount: parseFloat(form.amount),
      paid_at: form.paid_at,
      method: form.method || null,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Pagamento registrado");
    setForm({ amount: "", paid_at: new Date().toISOString().slice(0, 10), method: "", notes: "" });
    setOpen(false);
    onChange();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) return toast.error(error.message);
    onChange();
  };

  return (
    <Card className="mt-4 p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Histórico de pagamentos</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="mr-2 h-4 w-4" />Registrar</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo pagamento</DialogTitle></DialogHeader>
            <form onSubmit={add} className="space-y-3">
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Data</Label><Input type="date" required value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} /></div>
              <div><Label>Método</Label><Input placeholder="PIX, dinheiro..." value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} /></div>
              <div><Label>Observação</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <DialogFooter><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="mt-3 divide-y">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between py-3 text-sm">
            <div>
              <div className="font-medium">R$ {p.amount.toFixed(2)} {p.method && <span className="text-muted-foreground">· {p.method}</span>}</div>
              {p.notes && <div className="text-xs text-muted-foreground">{p.notes}</div>}
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{new Date(p.paid_at).toLocaleDateString("pt-BR")}</span>
              <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        {payments.length === 0 && <div className="py-6 text-center text-muted-foreground">Sem pagamentos</div>}
      </div>
    </Card>
  );
}
