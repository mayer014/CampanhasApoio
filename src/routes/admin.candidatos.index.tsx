import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Search, ExternalLink, Pencil, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";
import { exportLeadsXLSX } from "@/lib/export-leads";

type C = { id: string; full_name: string; email: string | null; phone: string | null; slug: string; is_blocked: boolean; notes?: string | null; trial_limit: number; created_at: string; signup_source: string; city: string | null; state: string | null; unblocked_at: string | null };
type Filter = "todos" | "aguardando" | "ativos" | "bloqueados";

export const Route = createFileRoute("/admin/candidatos/")({
  component: CandidatesList,
});

function CandidatesList() {
  const [items, setItems] = useState<C[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", phone: "", slug: "" });
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState<C | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = async () => {
    const [{ data: cands }, { data: tpls }] = await Promise.all([
      supabase.from("candidate_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("templates").select("candidate_id, generation_count"),
    ]);
    setItems(cands ?? []);
    const u: Record<string, number> = {};
    (tpls ?? []).forEach((t: any) => {
      u[t.candidate_id] = (u[t.candidate_id] ?? 0) + (t.generation_count ?? 0);
    });
    setUsage(u);
  };

  useEffect(() => { load(); }, []);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-candidate", {
        body: {
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          phone: form.phone || null,
          slug: form.slug || null,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Candidato criado!");
      setOpen(false);
      setForm({ email: "", password: "", full_name: "", phone: "", slug: "" });
      load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBlock = async (c: C, blocked: boolean) => {
    setTogglingId(c.id);
    const used = usage[c.id] ?? 0;
    const updates: { is_blocked: boolean; trial_limit?: number } = { is_blocked: blocked };
    // Se está liberando e o uso já estourou o limite, eleva o limite para liberar mais 5 fotos
    if (!blocked && used >= (c.trial_limit ?? 0)) {
      updates.trial_limit = used + 5;
    }
    const { error } = await supabase.from("candidate_profiles").update(updates).eq("id", c.id);
    setTogglingId(null);
    if (error) return toast.error(error.message);
    if (!blocked && updates.trial_limit) {
      toast.success(`Liberado · novo limite: ${updates.trial_limit} fotos`);
    } else {
      toast.success(blocked ? "Candidato bloqueado" : "Candidato liberado");
    }
    load();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    const { error } = await supabase.from("candidate_profiles").update({
      full_name: editing.full_name,
      phone: editing.phone,
      slug: editing.slug,
      notes: editing.notes ?? null,
      is_blocked: editing.is_blocked,
      trial_limit: editing.trial_limit,
    }).eq("id", editing.id);
    setSavingEdit(false);
    if (error) return toast.error(error.message);
    toast.success("Candidato atualizado");
    setEditing(null);
    load();
  };

  const exportLeads = async (c: C) => {
    setExportingId(c.id);
    try {
      const { data, error } = await supabase
        .from("voter_leads")
        .select("full_name, phone, street, number, neighborhood, created_at")
        .eq("candidate_id", c.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const leads = data ?? [];
      if (leads.length === 0) {
        toast.info("Este candidato ainda não tem eleitores cadastrados");
        return;
      }
      await exportLeadsXLSX(leads, c.full_name);
      toast.success(`${leads.length} eleitores exportados`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setExportingId(null);
    }
  };

  const filtered = items.filter((i) => i.full_name.toLowerCase().includes(q.toLowerCase()) || i.email?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Candidatos</h1>
          <p className="mt-1 text-muted-foreground">{items.length} candidatos cadastrados</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Novo candidato</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo candidato</DialogTitle></DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div><Label>Nome completo</Label><Input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Senha inicial (mín 8)</Label><Input type="text" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
              <div><Label>Telefone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Slug do link (opcional)</Label><Input placeholder="auto-gerado a partir do nome" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>{submitting ? "Criando..." : "Criar"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 flex items-center gap-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por nome ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      </div>

      <div className="mt-4 grid gap-3">
        {filtered.map((c) => {
          const used = usage[c.id] ?? 0;
          const limit = c.trial_limit ?? 0;
          const remaining = Math.max(0, limit - used);
          return (
            <Card key={c.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{c.full_name}</span>
                  {c.is_blocked ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">Bloqueado</span>
                  ) : (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Ativo</span>
                  )}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${remaining === 0 ? "bg-destructive/10 text-destructive" : remaining <= 2 ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>
                    {used}/{limit} fotos
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">{c.email} · /p/{c.slug}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-md border px-3 py-1.5">
                  <span className="text-xs text-muted-foreground">{c.is_blocked ? "Bloqueado" : "Liberado"}</span>
                  <Switch
                    checked={!c.is_blocked}
                    disabled={togglingId === c.id}
                    onCheckedChange={(v) => toggleBlock(c, !v)}
                  />
                </div>
                <a href={`/p/${c.slug}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline"><ExternalLink className="mr-2 h-4 w-4" />Link</Button>
                </a>
                <Button size="sm" variant="outline" onClick={() => exportLeads(c)} disabled={exportingId === c.id}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />{exportingId === c.id ? "Exportando..." : "Excel"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing({ ...c })}>
                  <Pencil className="mr-2 h-4 w-4" />Editar
                </Button>
                <Link to="/admin/candidatos/$id" params={{ id: c.id }}>
                  <Button size="sm">Gerenciar</Button>
                </Link>
              </div>
            </Card>
          );
        })}
        {filtered.length === 0 && <Card className="p-8 text-center text-muted-foreground">Nenhum candidato</Card>}
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar candidato</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label>Nome completo</Label><Input value={editing.full_name} onChange={(e) => setEditing({ ...editing, full_name: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input value={editing.email ?? ""} disabled /></div>
              <div><Label>Telefone</Label><Input value={editing.phone ?? ""} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
              <div><Label>Slug do link</Label><Input value={editing.slug} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} /></div>
              <div>
                <Label>Limite de fotos grátis</Label>
                <Input
                  type="number"
                  min={0}
                  value={editing.trial_limit}
                  onChange={(e) => setEditing({ ...editing, trial_limit: parseInt(e.target.value) || 0 })}
                />
                <p className="mt-1 text-xs text-muted-foreground">Usado: {usage[editing.id] ?? 0} fotos. Ao atingir o limite o candidato é bloqueado automaticamente.</p>
              </div>
              <div><Label>Observações (CRM)</Label><Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} /></div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="text-sm font-medium">Bloqueado</div>
                  <div className="text-xs text-muted-foreground">Impede o candidato de acessar o painel</div>
                </div>
                <Switch checked={editing.is_blocked} onCheckedChange={(v) => setEditing({ ...editing, is_blocked: v })} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
                <Button onClick={saveEdit} disabled={savingEdit}>{savingEdit ? "Salvando..." : "Salvar"}</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
