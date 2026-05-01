import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TemplateCanvas } from "@/components/template-canvas";
import { toast } from "sonner";
import type { TemplateData } from "@/lib/template-renderer";
import { Check, Plus, Pencil, Trash2, Info } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/painel/templates/")({
  component: TemplatesPage,
});

type Row = TemplateData & { id: string; name: string; is_active: boolean; generation_count: number };

const LIMIT = 3;

function TemplatesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("templates").select("*").eq("candidate_id", user.id).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const toggleActive = async (t: Row) => {
    const rpc = t.is_active ? "unset_active_template" : "set_active_template";
    const { error } = await supabase.rpc(rpc, { _template_id: t.id });
    if (error) return toast.error(error.message);
    toast.success(t.is_active ? "Template desativado" : "Template disponível para o eleitor");
    load();
  };

  const remove = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("templates").delete().eq("id", deleteId);
    setDeleteId(null);
    if (error) return toast.error(error.message);
    toast.success("Template excluído");
    load();
  };

  const createNew = () => {
    if (rows.length >= LIMIT) {
      toast.error(`Limite de ${LIMIT} templates atingido. Exclua um antigo para criar outro.`);
      return;
    }
    navigate({ to: "/painel/templates/$tplId", params: { tplId: "novo" } });
  };

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;

  const remaining = LIMIT - rows.length;
  const activeCount = rows.filter((r) => r.is_active).length;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">Meus templates</h1>
          <p className="mt-1 text-muted-foreground">
            {rows.length}/{LIMIT} templates · {activeCount} disponíveis para o eleitor.
          </p>
        </div>
        <Button onClick={createNew} disabled={rows.length >= LIMIT}>
          <Plus className="mr-2 h-4 w-4" /> Novo template
        </Button>
      </div>

      <Card className="mt-4 flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="text-sm">
          <p className="font-semibold text-foreground">Você pode criar até {LIMIT} templates</p>
          <p className="mt-1 text-muted-foreground">
            Marque quais ficam <strong>disponíveis</strong> e o eleitor escolhe qual usar no link público.
            Você pode deixar de 0 a {LIMIT} ativos ao mesmo tempo.
          </p>
        </div>
      </Card>

      {rows.length === 0 ? (
        <Card className="mt-8 p-8 text-center">
          <p className="text-muted-foreground">Você ainda não tem templates.</p>
          <Button className="mt-4" onClick={createNew}><Plus className="mr-2 h-4 w-4" /> Criar primeiro template</Button>
        </Card>
      ) : (
        <>
          <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {rows.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div className="bg-muted">
                  <TemplateCanvas template={t} className="w-full aspect-square" />
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold">{t.name}</h3>
                      <p className="text-xs text-muted-foreground">{t.generation_count} fotos geradas</p>
                    </div>
                    {t.is_active && <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"><Check className="h-3 w-3" />Disponível</span>}
                  </div>
                  <Button
                    className="mt-3 w-full"
                    variant={t.is_active ? "outline" : "default"}
                    onClick={() => toggleActive(t)}
                  >
                    {t.is_active ? "Tirar do link público" : "Disponibilizar para eleitor"}
                  </Button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Link to="/painel/templates/$tplId" params={{ tplId: t.id }} className="contents">
                      <Button variant="outline" size="sm" className="w-full"><Pencil className="mr-2 h-3 w-3" />Editar</Button>
                    </Link>
                    <Button variant="outline" size="sm" className="w-full text-destructive hover:text-destructive" onClick={() => setDeleteId(t.id)}>
                      <Trash2 className="mr-2 h-3 w-3" />Excluir
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
          {remaining > 0 && (
            <p className="mt-4 text-center text-xs text-muted-foreground">Você ainda pode criar mais {remaining} template{remaining > 1 ? "s" : ""}.</p>
          )}
        </>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este template?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Se este template estava disponível no link público, o eleitor não poderá mais escolhê-lo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
