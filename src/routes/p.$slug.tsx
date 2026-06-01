import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { TemplateCanvas } from "@/components/template-canvas";
import { downloadCanvas, renderTemplate, type PhotoState, type TemplateData } from "@/lib/template-renderer";
import { compressImage } from "@/lib/image-compress";
import { toast } from "sonner";
import { Rocket, Download, Upload } from "lucide-react";

export const Route = createFileRoute("/p/$slug")({
  component: PublicPage,
});

type Template = TemplateData & { id: string; name: string };

function TemplatePicker({ templates, onPick }: { templates: Template[]; onPick: (t: Template) => void }) {
  return (
    <div>
      <h2 className="text-2xl font-bold">Escolha sua arte</h2>
      <p className="mt-1 text-sm text-muted-foreground">{templates.length} {templates.length === 1 ? "opção disponível" : "opções disponíveis"}.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t)}
            className="group overflow-hidden rounded-xl border bg-card text-left transition hover:border-primary hover:shadow-lg"
          >
            <div className="bg-muted">
              <TemplateCanvas template={t} className="aspect-square w-full" />
            </div>
            <div className="p-3">
              <div className="font-semibold group-hover:text-primary">{t.name}</div>
              <div className="text-xs text-muted-foreground">Toque para usar</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function PublicPage() {
  const { slug } = Route.useParams();
  const [candidate, setCandidate] = useState<{ id: string; full_name: string } | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [step, setStep] = useState<"intro" | "form" | "pick" | "edit" | "done">("intro");
  const [notFound, setNotFound] = useState(false);
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);

  useEffect(() => {
    if (!candidate) return;
    try {
      if (localStorage.getItem(`lead_done:${candidate.id}`) === "1") {
        setAlreadyRegistered(true);
      }
    } catch {/* ignore */}
  }, [candidate]);

  useEffect(() => {
    (async () => {
      const normalized = decodeURIComponent(slug)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      let cand: { id: string; full_name: string; is_blocked: boolean } | null = null;
      const r1 = await supabase.from("candidate_profiles").select("id, full_name, is_blocked").eq("slug", slug).maybeSingle();
      cand = r1.data ?? null;
      if (!cand && normalized && normalized !== slug) {
        const r2 = await supabase.from("candidate_profiles").select("id, full_name, is_blocked").eq("slug", normalized).maybeSingle();
        cand = r2.data ?? null;
      }
      if (!cand) {
        const r3 = await supabase.from("candidate_profiles").select("id, full_name, is_blocked").ilike("slug", decodeURIComponent(slug)).maybeSingle();
        cand = r3.data ?? null;
      }

      if (!cand || cand.is_blocked) { setNotFound(true); return; }
      setCandidate({ id: cand.id, full_name: cand.full_name });
      const { data: tpls } = await supabase.from("templates").select("*").eq("candidate_id", cand.id).eq("is_active", true).order("created_at", { ascending: false });
      const list = (tpls ?? []) as unknown as Template[];
      setTemplates(list);
      if (list.length === 1) setTemplate(list[0]);
    })();
  }, [slug]);

  if (notFound) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Link inválido ou indisponível.</div>;
  if (!candidate) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando…</div>;

  const handleStart = () => {
    if (alreadyRegistered) {
      // já cadastrou: vai direto pra escolher (ou editor se só tem 1)
      setStep(templates.length > 1 ? "pick" : "edit");
    } else {
      setStep("form");
    }
  };

  const handleFormDone = () => {
    try { if (candidate) localStorage.setItem(`lead_done:${candidate.id}`, "1"); } catch {/* ignore */}
    setAlreadyRegistered(true);
    setStep(templates.length > 1 ? "pick" : "edit");
  };

  const previewTemplate = template ?? templates[0] ?? null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto flex items-center gap-2 px-6 py-4">
          <Rocket className="h-5 w-5 text-primary" />
          <span className="font-semibold">{candidate.full_name}</span>
        </div>
      </header>
      <main className="container mx-auto max-w-5xl px-6 py-10">
        {templates.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground">O candidato ainda não disponibilizou nenhum template.</Card>
        ) : step === "intro" ? (
          <Intro candidate={candidate} template={previewTemplate!} alreadyRegistered={alreadyRegistered} onStart={handleStart} />
        ) : step === "form" ? (
          <FormStep
            candidateId={candidate.id}
            templateId={(previewTemplate ?? templates[0]).id}
            onDone={handleFormDone}
          />
        ) : step === "pick" ? (
          <TemplatePicker templates={templates} onPick={(t) => { setTemplate(t); setStep("edit"); }} />
        ) : step === "edit" && template ? (
          <div>
            {templates.length > 1 && (
              <button
                type="button"
                onClick={() => setStep("pick")}
                className="mb-4 text-sm text-primary underline-offset-4 hover:underline"
              >
                ← Escolher outra arte
              </button>
            )}
            <EditorStep template={template} candidateName={candidate.full_name} />
          </div>
        ) : null}
      </main>
    </div>
  );
}

function Intro({ candidate, template, onStart, alreadyRegistered }: { candidate: { full_name: string }; template: Template; onStart: () => void; alreadyRegistered: boolean }) {
  return (
    <div className="grid gap-8 md:grid-cols-2 md:items-center">
      <div>
        <h1 className="text-4xl font-bold">Apoie {candidate.full_name}</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          {alreadyRegistered
            ? "Bem-vindo de volta! Você já está cadastrado. Escolha uma nova foto e apoie a campanha."
            : "Mostre seu apoio! Personalize sua foto e compartilhe nas redes."}
        </p>
        <Button size="lg" className="mt-6" onClick={onStart}>
          {alreadyRegistered ? "Trocar minha foto" : "Quero minha foto"}
        </Button>
      </div>
      <Card className="overflow-hidden">
        <TemplateCanvas template={template} />
      </Card>
    </div>
  );
}

function FormStep({ candidateId, templateId, onDone }: { candidateId: string; templateId: string; onDone: () => void }) {
  const [form, setForm] = useState({ full_name: "", phone: "", street: "", number: "", neighborhood: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("voter_leads").insert({ candidate_id: candidateId, template_id: templateId, ...form });
    setLoading(false);
    // 23505 = unique_violation: já existe lead com mesmo (candidate_id, telefone normalizado)
    if (error && (error.code === "23505" || /duplicate|unique/i.test(error.message))) {
      toast.success("Você já está cadastrado. Bem-vindo de volta!");
      onDone();
      return;
    }
    if (error) return toast.error(error.message);
    onDone();
  };

  return (
    <Card className="mx-auto max-w-lg p-8">
      <h2 className="text-2xl font-bold">Seus dados</h2>
      <p className="mt-1 text-sm text-muted-foreground">Preencha para liberar sua foto da campanha.</p>
      <form onSubmit={submit} className="mt-6 space-y-3">
        <div><Label>Nome completo</Label><Input required maxLength={120} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><Label>Telefone (WhatsApp)</Label><Input required maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
          <div><Label>Rua</Label><Input required maxLength={150} value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} /></div>
          <div><Label>Número</Label><Input required maxLength={20} value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} /></div>
        </div>
        <div><Label>Bairro</Label><Input required maxLength={100} value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} /></div>
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Enviando..." : "Continuar"}</Button>
      </form>
    </Card>
  );
}

function EditorStep({ template, candidateName }: { template: Template; candidateName: string }) {
  const [photo, setPhoto] = useState<PhotoState | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [converting, setConverting] = useState(false);

  const handleFile = async (file: File) => {
    let workingFile: File | Blob = file;

    // iPhone HEIC/HEIF: navegadores não-Safari não decodificam. Converte para JPEG.
    const isHeic =
      /\.(heic|heif)$/i.test(file.name) ||
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      file.type === "";
    if (isHeic) {
      try {
        setConverting(true);
        toast.loading("Convertendo foto do iPhone...", { id: "heic" });
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
        workingFile = Array.isArray(converted) ? converted[0] : converted;
        toast.success("Foto pronta!", { id: "heic" });
      } catch (err) {
        // Se não era HEIC de verdade (type vazio mas era PNG/JPG), segue normal
        if (file.type && (file.type === "image/heic" || file.type === "image/heif" || /\.(heic|heif)$/i.test(file.name))) {
          toast.error("Não foi possível converter a foto. Tente enviar como JPG.", { id: "heic" });
          setConverting(false);
          return;
        }
        toast.dismiss("heic");
      } finally {
        setConverting(false);
      }
    }

    // Compressão: redimensiona até 2000px e re-encoda como JPEG 85%.
    // Tudo no navegador — nada é enviado ao servidor.
    try {
      setConverting(true);
      const compressed = await compressImage(workingFile, { maxDim: 2000, quality: 0.85 });
      workingFile = compressed;
    } catch (err) {
      toast.error("Não foi possível processar a imagem.");
      setConverting(false);
      return;
    } finally {
      setConverting(false);
    }

    // Lê + valida que o navegador consegue decodificar antes de mostrar
    let dataUrl: string;
    try {
      dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error ?? new Error("read"));
        reader.readAsDataURL(workingFile);
      });
    } catch {
      toast.error("Não foi possível ler o arquivo. Tente outra foto.");
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        const test = new Image();
        test.onload = () => (test.naturalWidth > 0 ? resolve() : reject(new Error("empty")));
        test.onerror = () => reject(new Error("decode"));
        test.src = dataUrl;
      });
    } catch {
      toast.error("Formato de imagem não suportado pelo seu navegador. Use JPG, PNG ou WebP.");
      return;
    }

    setPhoto({
      src: dataUrl,
      x: template.photo_circle.x,
      y: template.photo_circle.y,
      scale: 1,
    });
  };

  useEffect(() => {
    if (!photo) return;
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth === 0 || img.naturalHeight === 0) {
        toast.error("A imagem está corrompida. Tente outra foto.");
        setPhoto(null);
        return;
      }
      const target = template.photo_circle.radius * 2.2;
      const scale = target / Math.min(img.naturalWidth, img.naturalHeight);
      setPhoto((p) => p ? { ...p, scale } : p);
    };
    img.onerror = () => {
      toast.error("Não foi possível pré-visualizar essa imagem.");
      setPhoto(null);
    };
    img.src = photo.src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo?.src]);

  const download = async () => {
    if (!canvasRef.current) return;
    await renderTemplate(canvasRef.current, template, photo);
    downloadCanvas(canvasRef.current, `foto-${candidateName.replace(/\s+/g, "-").toLowerCase()}.png`);
    await supabase.rpc("increment_template_generation", { _template_id: template.id });
    toast.success("Foto baixada! Use no seu WhatsApp.");
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_300px]">
      <Card className="p-4">
        <TemplateCanvas template={template} photo={photo} />
        <canvas ref={canvasRef} className="hidden" />
      </Card>
      <div className="space-y-4">
        <Card className="p-4">
          <Label>Sua foto</Label>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <Button variant="outline" className="mt-2 w-full" onClick={() => fileRef.current?.click()} disabled={converting}>
            <Upload className="mr-2 h-4 w-4" />{converting ? "Convertendo..." : photo ? "Trocar foto" : "Enviar foto"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">Aceita JPG, PNG, WebP e HEIC (iPhone). Até 15 MB.</p>
        </Card>

        {photo && (
          <Card className="space-y-3 p-4">
            <Label className="font-semibold">Ajuste o enquadramento</Label>
            <div>
              <Label className="text-xs">Zoom: {photo.scale.toFixed(2)}x</Label>
              <Slider value={[photo.scale]} min={0.1} max={5} step={0.02} onValueChange={(v) => setPhoto({ ...photo, scale: v[0] })} />
            </div>
            <div>
              <Label className="text-xs">Horizontal</Label>
              <Slider value={[photo.x]} min={0} max={1080} step={1} onValueChange={(v) => setPhoto({ ...photo, x: v[0] })} />
            </div>
            <div>
              <Label className="text-xs">Vertical</Label>
              <Slider value={[photo.y]} min={0} max={1080} step={1} onValueChange={(v) => setPhoto({ ...photo, y: v[0] })} />
            </div>
          </Card>
        )}

        <Button size="lg" className="w-full" disabled={!photo} onClick={download}>
          <Download className="mr-2 h-4 w-4" /> Baixar foto
        </Button>
        <p className="text-center text-xs text-muted-foreground">PNG quadrado 1080x1080</p>
      </div>
    </div>
  );
}
