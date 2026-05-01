import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TemplateCanvas } from "@/components/template-canvas";
import { toast } from "sonner";
import type { TemplateData } from "@/lib/template-renderer";
import { Check, Plus, Pencil, Trash2, Info, MessageCircle, Layers, Image as ImageIcon, Move, Save, Sparkles, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DEFAULT_TEMPLATE, DEFAULT_TEMPLATE_NAME } from "@/lib/default-template";

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
    let { data, error } = await supabase.from("templates").select("*").eq("candidate_id", user.id).order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    // Auto-provisiona o template "Padrão do Sistema" para todo candidato novo
    const hasDefault = (data ?? []).some((t: any) => t.name === DEFAULT_TEMPLATE_NAME);
    if (!hasDefault) {
      const { error: insErr } = await supabase.from("templates").insert({
        candidate_id: user.id,
        name: DEFAULT_TEMPLATE.name,
        background_url: DEFAULT_TEMPLATE.background_url,
        base_circle_url: DEFAULT_TEMPLATE.base_circle_url,
        element_url: DEFAULT_TEMPLATE.element_url,
        logo_url: DEFAULT_TEMPLATE.logo_url,
        background_transform: DEFAULT_TEMPLATE.background_transform,
        base_circle_transform: DEFAULT_TEMPLATE.base_circle_transform,
        element_transform: DEFAULT_TEMPLATE.element_transform,
        logo_transform: DEFAULT_TEMPLATE.logo_transform,
        photo_circle: DEFAULT_TEMPLATE.photo_circle,
        is_active: true,
      });
      if (!insErr) {
        const reload = await supabase.from("templates").select("*").eq("candidate_id", user.id).order("created_at", { ascending: false });
        data = reload.data ?? data;
      }
    }

    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const defaultTpl = rows.find((r) => r.name === DEFAULT_TEMPLATE_NAME);
  const defaultMissingLogo = defaultTpl && !defaultTpl.logo_url;

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

      <Card className="mt-4 p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Como criar um template</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Cada template tem 5 camadas. Monte na ordem abaixo para um resultado profissional:
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2">
          <li className="flex gap-3 rounded-md border bg-card p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">1</span>
            <div className="text-sm">
              <p className="font-medium flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Fundo (1080×1080)</p>
              <p className="text-muted-foreground">Imagem de base do template. Use PNG ou JPG quadrado em alta resolução.</p>
            </div>
          </li>
          <li className="flex gap-3 rounded-md border bg-card p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">2</span>
            <div className="text-sm">
              <p className="font-medium flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Círculo base</p>
              <p className="text-muted-foreground">Moldura que aparece <strong>atrás</strong> da foto do eleitor (PNG com transparência).</p>
            </div>
          </li>
          <li className="flex gap-3 rounded-md border bg-card p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">3</span>
            <div className="text-sm">
              <p className="font-medium flex items-center gap-1"><Move className="h-3.5 w-3.5" /> Círculo da foto</p>
              <p className="text-muted-foreground">Define <strong>onde</strong> e em que tamanho a foto do eleitor será recortada. Ajuste X, Y e raio.</p>
            </div>
          </li>
          <li className="flex gap-3 rounded-md border bg-card p-3">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">4</span>
            <div className="text-sm">
              <p className="font-medium flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> Elemento</p>
              <p className="text-muted-foreground">Camada decorativa <strong>por cima</strong> da foto (faixas, números, slogans).</p>
            </div>
          </li>
          <li className="flex gap-3 rounded-md border bg-card p-3 sm:col-span-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">5</span>
            <div className="text-sm">
              <p className="font-medium flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Logo</p>
              <p className="text-muted-foreground">Logotipo da campanha — fica na camada mais alta. Posicione com os controles de X, Y e zoom.</p>
            </div>
          </li>
        </ol>
        <div className="mt-4 rounded-md border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground flex items-center gap-1"><Save className="h-3.5 w-3.5" /> Dica final</p>
          <p className="mt-1">
            Arraste as camadas direto no canvas para posicionar. Após salvar, clique em <strong>“Disponibilizar para eleitor”</strong> para o template aparecer no link público.
          </p>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden border-[#25D366]/40 bg-gradient-to-br from-[#25D366]/10 to-transparent p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold">Quer que a gente monte o template para você?</h3>
              <p className="text-sm text-muted-foreground">
                Nossa equipe cria seu template profissional sob medida. <strong>Valor a combinar</strong> conforme a complexidade.
              </p>
            </div>
          </div>
          <a
            href="https://wa.me/5567992773931?text=Ol%C3%A1!%20Quero%20que%20voc%C3%AAs%20montem%20um%20template%20para%20minha%20campanha."
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0"
          >
            <Button className="bg-[#25D366] text-white hover:bg-[#1ebe5d]">
              <MessageCircle className="mr-2 h-4 w-4" /> Falar no WhatsApp
            </Button>
          </a>
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
