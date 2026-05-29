import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

type Settings = {
  whatsapp_number: string | null;
};

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
  const [s, setS] = useState<Settings>({ whatsapp_number: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("whatsapp_number").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setS({
        whatsapp_number: data.whatsapp_number ?? "",
      });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({
      whatsapp_number: s.whatsapp_number || null,
    }).eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Configurações salvas");
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Configurações globais</h1>
      <p className="mt-1 text-muted-foreground">
        Configurações gerais do sistema.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Contato</h2>
            <p className="text-sm text-muted-foreground">WhatsApp para suporte e atendimento aos candidatos.</p>
          </div>
          <div>
            <Label>WhatsApp (com DDI, só números)</Label>
            <Input
              placeholder="5567999999999"
              value={s.whatsapp_number ?? ""}
              onChange={(e) => setS({ ...s, whatsapp_number: e.target.value.replace(/\D/g, "") })}
            />
            <p className="mt-1 text-xs text-muted-foreground">Ex: 5567999999999 (Brasil + DDD + número)</p>
          </div>
        </Card>

      </div>

      <div className="mt-6">
        <Button onClick={save} disabled={saving} size="lg">
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar configurações"}
        </Button>
      </div>
    </div>
  );
}