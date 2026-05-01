import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TemplateCanvas } from "@/components/template-canvas";
import { toast } from "sonner";
import type { TemplateData } from "@/lib/template-renderer";
import { Check } from "lucide-react";

export const Route = createFileRoute("/painel/templates")({
  component: TemplatesPage,
});

type Row = TemplateData & { id: string; name: string; is_active: boolean; generation_count: number };

function TemplatesPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("templates").select("*").eq("candidate_id", user.id).order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    setRows((data as unknown as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const activate = async (id: string) => {
    const { error } = await supabase.rpc("set_active_template", { _template_id: id });
    if (error) return toast.error(error.message);
    toast.success("Template ativado no link público");
    load();
  };

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold">Meus templates</h1>
      <p className="mt-1 text-muted-foreground">Escolha qual template fica ativo no seu link público.</p>

      {rows.length === 0 ? (
        <Card className="mt-8 p-8 text-center text-muted-foreground">
          Você ainda não tem templates. Peça ao administrador para configurar.
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rows.map((t) => (
            <Card key={t.id} className="overflow-hidden">
              <div className="bg-muted">
                <TemplateCanvas template={t} className="w-full aspect-square" />
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{t.name}</h3>
                    <p className="text-xs text-muted-foreground">{t.generation_count} fotos geradas</p>
                  </div>
                  {t.is_active && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"><Check className="h-3 w-3" />Ativo</span>}
                </div>
                <Button
                  className="mt-3 w-full"
                  variant={t.is_active ? "outline" : "default"}
                  onClick={() => activate(t.id)}
                  disabled={t.is_active}
                >
                  {t.is_active ? "Já está ativo" : "Tornar ativo"}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
