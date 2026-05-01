import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, Save } from "lucide-react";

type Settings = {
  whatsapp_number: string | null;
  pix_key: string | null;
  pix_qr_url: string | null;
  pix_owner_name: string | null;
};

export const Route = createFileRoute("/admin/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
  const [s, setS] = useState<Settings>({ whatsapp_number: "", pix_key: "", pix_qr_url: "", pix_owner_name: "" });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data) setS({
        whatsapp_number: data.whatsapp_number ?? "",
        pix_key: data.pix_key ?? "",
        pix_qr_url: data.pix_qr_url ?? "",
        pix_owner_name: data.pix_owner_name ?? "",
      });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("app_settings").update({
      whatsapp_number: s.whatsapp_number || null,
      pix_key: s.pix_key || null,
      pix_qr_url: s.pix_qr_url || null,
      pix_owner_name: s.pix_owner_name || null,
    }).eq("id", 1);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Configurações salvas");
  };

  const uploadQr = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `pix-qr/qr-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("template-layers").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("template-layers").getPublicUrl(path);
      setS((prev) => ({ ...prev, pix_qr_url: data.publicUrl }));
      toast.success("QR enviado, clique em Salvar");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h1 className="text-3xl font-bold">Configurações globais</h1>
      <p className="mt-1 text-muted-foreground">
        Esses dados aparecem para todos os candidatos na hora de renovar a assinatura.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Contato</h2>
            <p className="text-sm text-muted-foreground">WhatsApp para receber comprovantes e atendimento.</p>
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

        <Card className="space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">PIX</h2>
            <p className="text-sm text-muted-foreground">Dados que o candidato vê para pagar a mensalidade.</p>
          </div>
          <div>
            <Label>Nome do titular</Label>
            <Input value={s.pix_owner_name ?? ""} onChange={(e) => setS({ ...s, pix_owner_name: e.target.value })} />
          </div>
          <div>
            <Label>Chave PIX (aleatória)</Label>
            <Input value={s.pix_key ?? ""} onChange={(e) => setS({ ...s, pix_key: e.target.value })} />
          </div>
          <div>
            <Label>QR Code do PIX (imagem)</Label>
            <div className="mt-2 flex items-start gap-4">
              {s.pix_qr_url && (
                <img src={s.pix_qr_url} alt="QR PIX" className="h-32 w-32 rounded-md border bg-white object-contain p-2" />
              )}
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && uploadQr(e.target.files[0])}
                />
                <Button asChild variant="outline" disabled={uploading}>
                  <span>
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? "Enviando..." : s.pix_qr_url ? "Trocar QR" : "Enviar QR"}
                  </span>
                </Button>
              </label>
            </div>
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
