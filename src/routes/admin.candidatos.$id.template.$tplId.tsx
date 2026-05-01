import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TemplateCanvas } from "@/components/template-canvas";
import type { TemplateData, Transform, PhotoCircle } from "@/lib/template-renderer";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/candidatos/$id/template/$tplId")({
  component: TemplateEditor,
});

type LayerKey = "background" | "base_circle" | "element" | "logo";

const DEFAULT: TemplateData & { name: string } = {
  name: "Novo template",
  background_url: null,
  base_circle_url: null,
  element_url: null,
  logo_url: null,
  background_transform: { x: 0, y: 0, scale: 1 },
  base_circle_transform: { x: 540, y: 540, scale: 1 },
  element_transform: { x: 540, y: 540, scale: 1 },
  logo_transform: { x: 540, y: 540, scale: 1 },
  photo_circle: { x: 540, y: 540, radius: 350 },
};

function TemplateEditor() {
  const { id, tplId } = Route.useParams();
  const navigate = useNavigate();
  const isNew = tplId === "novo";
  const [data, setData] = useState<typeof DEFAULT>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const fileRefs = useRef<Record<LayerKey, HTMLInputElement | null>>({ background: null, base_circle: null, element: null, logo: null });

  useEffect(() => {
    if (isNew) return;
    supabase.from("templates").select("*").eq("id", tplId).single().then(({ data: t }) => {
      if (t) setData(t as unknown as typeof DEFAULT);
    });
  }, [tplId, isNew]);

  const upload = async (key: LayerKey, file: File) => {
    const ext = file.name.split(".").pop() || "png";
    const path = `${id}/${key}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("template-layers").upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data: pub } = supabase.storage.from("template-layers").getPublicUrl(path);
    setData((d) => ({ ...d, [`${key}_url`]: pub.publicUrl } as typeof DEFAULT));
    toast.success("Imagem enviada");
  };

  const setTransform = (key: LayerKey, t: Transform) => {
    setData((d) => ({ ...d, [`${key}_transform`]: t } as typeof DEFAULT));
  };
  const setPhoto = (p: PhotoCircle) => setData((d) => ({ ...d, photo_circle: p }));

  const save = async () => {
    setSaving(true);
    const payload = {
      candidate_id: id,
      name: data.name,
      background_url: data.background_url,
      base_circle_url: data.base_circle_url,
      element_url: data.element_url,
      logo_url: data.logo_url,
      background_transform: data.background_transform,
      base_circle_transform: data.base_circle_transform,
      element_transform: data.element_transform,
      logo_transform: data.logo_transform,
      photo_circle: data.photo_circle,
    };
    if (isNew) {
      const { data: created, error } = await supabase.from("templates").insert(payload).select("id").single();
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Template criado");
      navigate({ to: "/admin/candidatos/$id/template/$tplId", params: { id, tplId: created.id } });
    } else {
      const { error } = await supabase.from("templates").update(payload).eq("id", tplId);
      setSaving(false);
      if (error) return toast.error(error.message);
      toast.success("Template salvo");
    }
  };

  const layers: { key: LayerKey; label: string; hint?: string; transformKey: keyof TemplateData; urlKey: keyof TemplateData }[] = [
    { key: "background", label: "1. Fundo (1080x1080)", hint: "Camada inferior — imagem de fundo do template.", transformKey: "background_transform", urlKey: "background_url" },
    { key: "base_circle", label: "2. Círculo base", hint: "Moldura/base que fica ATRÁS da foto do eleitor.", transformKey: "base_circle_transform", urlKey: "base_circle_url" },
    { key: "element", label: "4. Elemento (acima da foto)", hint: "Camada decorativa que fica POR CIMA da foto do eleitor (ex: moldura com texto curvo).", transformKey: "element_transform", urlKey: "element_url" },
    { key: "logo", label: "5. Logo", hint: "Camada superior — logotipo da campanha.", transformKey: "logo_transform", urlKey: "logo_url" },
  ];

  

  return (
    <div>
      <Link to="/admin/candidatos/$id" params={{ id }} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao candidato</Link>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{isNew ? "Novo template" : "Editar template"}</h1>
        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px]">
        <Card className="p-4">
          <TemplateCanvas template={data} photo={demoPhoto} />
          <p className="mt-2 text-xs text-muted-foreground text-center">Pré-visualização com foto de demonstração</p>
        </Card>

        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <Label>Nome do template</Label>
            <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
          </Card>

          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Ordem das camadas (de baixo para cima):</p>
            <p>1. Fundo → 2. Círculo base → <span className="text-primary font-medium">3. Foto do eleitor (recortada no círculo)</span> → 4. Elemento → 5. Logo</p>
          </div>

          {layers.slice(0, 2).map(({ key, label, hint, transformKey, urlKey }) => {
            const t = data[transformKey] as Transform;
            const url = data[urlKey] as string | null;
            return (
              <Card key={key} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">{label}</Label>
                  <Button size="sm" variant="outline" onClick={() => fileRefs.current[key]?.click()}>
                    <Upload className="mr-2 h-3 w-3" />{url ? "Trocar" : "Enviar"}
                  </Button>
                  <input ref={(el) => { fileRefs.current[key] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(key, e.target.files[0])} />
                </div>
                {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                {url && <img src={url} alt={label} className="h-16 rounded border bg-muted object-contain" />}
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">X</Label><Input type="number" value={t.x} onChange={(e) => setTransform(key, { ...t, x: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Y</Label><Input type="number" value={t.y} onChange={(e) => setTransform(key, { ...t, y: Number(e.target.value) })} /></div>
                </div>
                <div>
                  <Label className="text-xs">Zoom: {t.scale.toFixed(2)}x</Label>
                  <Slider value={[t.scale]} min={0.1} max={3} step={0.05} onValueChange={(v) => setTransform(key, { ...t, scale: v[0] })} />
                </div>
              </Card>
            );
          })}

          <Card className="space-y-3 p-4 border-primary/40">
            <Label className="font-semibold">3. Círculo da foto do eleitor</Label>
            <p className="text-xs text-muted-foreground">
              Define a posição (X, Y) e o raio do círculo onde a foto enviada pelo eleitor será recortada.
              Esta camada fica ENTRE o círculo base e o elemento decorativo.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div><Label className="text-xs">X</Label><Input type="number" value={data.photo_circle.x} onChange={(e) => setPhoto({ ...data.photo_circle, x: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Y</Label><Input type="number" value={data.photo_circle.y} onChange={(e) => setPhoto({ ...data.photo_circle, y: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Raio</Label><Input type="number" value={data.photo_circle.radius} onChange={(e) => setPhoto({ ...data.photo_circle, radius: Number(e.target.value) })} /></div>
            </div>
          </Card>

          {layers.slice(2).map(({ key, label, hint, transformKey, urlKey }) => {
            const t = data[transformKey] as Transform;
            const url = data[urlKey] as string | null;
            return (
              <Card key={key} className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">{label}</Label>
                  <Button size="sm" variant="outline" onClick={() => fileRefs.current[key]?.click()}>
                    <Upload className="mr-2 h-3 w-3" />{url ? "Trocar" : "Enviar"}
                  </Button>
                  <input ref={(el) => { fileRefs.current[key] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(key, e.target.files[0])} />
                </div>
                {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                {url && <img src={url} alt={label} className="h-16 rounded border bg-muted object-contain" />}
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">X</Label><Input type="number" value={t.x} onChange={(e) => setTransform(key, { ...t, x: Number(e.target.value) })} /></div>
                  <div><Label className="text-xs">Y</Label><Input type="number" value={t.y} onChange={(e) => setTransform(key, { ...t, y: Number(e.target.value) })} /></div>
                </div>
                <div>
                  <Label className="text-xs">Zoom: {t.scale.toFixed(2)}x</Label>
                  <Slider value={[t.scale]} min={0.1} max={3} step={0.05} onValueChange={(v) => setTransform(key, { ...t, scale: v[0] })} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
