import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TemplateEditorCanvas, type DraggableLayerKey } from "@/components/template-editor-canvas";
import type { TemplateData, Transform, PhotoCircle } from "@/lib/template-renderer";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/painel/templates/$tplId")({
  component: CandidateTemplateEditor,
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

function CandidateTemplateEditor() {
  const { tplId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isNew = tplId === "novo";
  const [data, setData] = useState<typeof DEFAULT>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<DraggableLayerKey>("photo_circle");
  const fileRefs = useRef<Record<LayerKey, HTMLInputElement | null>>({ background: null, base_circle: null, element: null, logo: null });

  useEffect(() => {
    if (isNew) return;
    supabase.from("templates").select("*").eq("id", tplId).single().then(({ data: t }) => {
      if (t) setData(t as unknown as typeof DEFAULT);
    });
  }, [tplId, isNew]);

  const upload = async (key: LayerKey, file: File) => {
    if (!user) return;
    const ext = file.name.split(".").pop() || "png";
    const path = `${user.id}/${key}-${Date.now()}.${ext}`;
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

  const handleCanvasDrag = (key: DraggableLayerKey, next: { x: number; y: number }) => {
    if (key === "photo_circle") {
      setPhoto({ ...data.photo_circle, x: next.x, y: next.y });
    } else {
      const t = data[`${key}_transform` as const] as Transform;
      setTransform(key, { ...t, x: next.x, y: next.y });
    }
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      candidate_id: user.id,
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
      navigate({ to: "/painel/templates/$tplId", params: { tplId: created.id } });
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
    { key: "element", label: "4. Elemento (acima da foto)", hint: "Camada decorativa que fica POR CIMA da foto do eleitor.", transformKey: "element_transform", urlKey: "element_url" },
    { key: "logo", label: "5. Logo", hint: "Camada superior — logotipo da campanha.", transformKey: "logo_transform", urlKey: "logo_url" },
  ];

  const renderLayerCard = ({ key, label, hint, transformKey, urlKey }: typeof layers[number]) => {
    const t = data[transformKey] as Transform;
    const url = data[urlKey] as string | null;
    const isSelected = selected === key;
    return (
      <Card
        key={key}
        className={cn("space-y-3 p-4 cursor-pointer transition-colors", isSelected && "border-primary ring-2 ring-primary/30")}
        onClick={() => setSelected(key)}
      >
        <div className="flex items-center justify-between">
          <Label className="font-semibold cursor-pointer">{label}</Label>
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); fileRefs.current[key]?.click(); }}>
            <Upload className="mr-2 h-3 w-3" />{url ? "Trocar" : "Enviar"}
          </Button>
          <input ref={(el) => { fileRefs.current[key] = el; }} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(key, e.target.files[0])} />
        </div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        {url && <img src={url} alt={label} className="h-16 rounded border bg-muted object-contain" />}
        <div className="space-y-2">
          <div>
            <Label className="text-xs">X: {t.x}</Label>
            <Slider value={[t.x]} min={-540} max={1620} step={1} onValueChange={(v) => setTransform(key, { ...t, x: v[0] })} />
          </div>
          <div>
            <Label className="text-xs">Y: {t.y}</Label>
            <Slider value={[t.y]} min={-540} max={1620} step={1} onValueChange={(v) => setTransform(key, { ...t, y: v[0] })} />
          </div>
          <div>
            <Label className="text-xs">Zoom: {t.scale.toFixed(2)}x</Label>
            <Slider value={[t.scale]} min={0.1} max={3} step={0.05} onValueChange={(v) => setTransform(key, { ...t, scale: v[0] })} />
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div>
      <Link to="/painel/templates" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-1 h-4 w-4" /> Voltar aos templates</Link>
      <div className="mt-2 flex items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{isNew ? "Novo template" : "Editar template"}</h1>
        <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_400px] items-start lg:h-[calc(100vh-8rem)]">
        <div className="lg:h-full lg:overflow-hidden flex items-start justify-center">
          <Card className="p-4 w-full lg:max-h-full lg:flex lg:flex-col">
            <div className="lg:flex-1 lg:min-h-0 flex items-center justify-center">
              <TemplateEditorCanvas
                template={data}
                selected={selected}
                onChange={handleCanvasDrag}
                className="max-h-full max-w-full aspect-square rounded-lg border bg-card touch-none select-none"
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Arraste a camada selecionada (<span className="font-medium text-foreground">{selected}</span>) diretamente no canvas. Clique numa camada à direita para selecioná-la.
            </p>
          </Card>
        </div>

        <div className="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-2">
          <Card className="space-y-3 p-4">
            <Label>Nome do template</Label>
            <Input value={data.name} onChange={(e) => setData({ ...data, name: e.target.value })} />
          </Card>

          <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Ordem (de baixo para cima):</p>
            <p>1. Fundo → 2. Círculo base → <span className="text-primary font-medium">3. Foto do eleitor</span> → 4. Elemento → 5. Logo</p>
          </div>

          {layers.slice(0, 2).map(renderLayerCard)}

          <Card
            className={cn("space-y-3 p-4 cursor-pointer transition-colors border-primary/40", selected === "photo_circle" && "border-primary ring-2 ring-primary/30")}
            onClick={() => setSelected("photo_circle")}
          >
            <Label className="font-semibold cursor-pointer">3. Círculo da foto do eleitor</Label>
            <p className="text-xs text-muted-foreground">
              Define a posição e o raio do círculo onde a foto enviada pelo eleitor será recortada.
            </p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs">X: {data.photo_circle.x}</Label>
                <Slider value={[data.photo_circle.x]} min={0} max={1080} step={1} onValueChange={(v) => setPhoto({ ...data.photo_circle, x: v[0] })} />
              </div>
              <div>
                <Label className="text-xs">Y: {data.photo_circle.y}</Label>
                <Slider value={[data.photo_circle.y]} min={0} max={1080} step={1} onValueChange={(v) => setPhoto({ ...data.photo_circle, y: v[0] })} />
              </div>
              <div>
                <Label className="text-xs">Raio: {data.photo_circle.radius}</Label>
                <Slider value={[data.photo_circle.radius]} min={20} max={540} step={1} onValueChange={(v) => setPhoto({ ...data.photo_circle, radius: v[0] })} />
              </div>
            </div>
          </Card>

          {layers.slice(2).map(renderLayerCard)}
        </div>
      </div>
    </div>
  );
}
