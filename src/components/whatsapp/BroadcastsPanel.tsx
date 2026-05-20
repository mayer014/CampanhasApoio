import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Image as ImageIcon,
  Loader2,
  Play,
  Pause,
  Plus,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  createBroadcast,
  deleteBroadcast,
  pauseBroadcast,
  startBroadcast,
} from "@/lib/whatsapp.functions";


type Broadcast = {
  id: string;
  name: string;
  status: "draft" | "running" | "paused" | "completed" | "failed";
  total: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  created_at: string;
  next_send_at: string | null;
  message_text: string;
  media_url: string | null;
};

type Recipient = {
  jid: string;
  display_name?: string | null;
  variables?: Record<string, string>;
};

export function BroadcastsPanel({
  accessToken,
  candidateId,
}: {
  accessToken: string | null;
  candidateId: string;
}) {
  const [list, setList] = useState<Broadcast[]>([]);
  const [creating, setCreating] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_broadcasts")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    setList((data || []) as any);
  };
  useEffect(() => {
    load();
    const channel = supabase
      .channel(`wa-bc-${candidateId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_broadcasts",
          filter: `candidate_id=eq.${candidateId}`,
        },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [candidateId]);

  const onStart = async (id: string) => {
    if (!accessToken) return;
    try {
      await startBroadcast({
        data: { access_token: accessToken, candidate_id: candidateId, id },
      });
      toast.success("Campanha iniciada");
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  };
  const onPause = async (id: string) => {
    if (!accessToken) return;
    try {
      await pauseBroadcast({
        data: { access_token: accessToken, candidate_id: candidateId, id },
      });
      toast.success("Pausada");
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  };
  const onDelete = async (id: string) => {
    if (!accessToken) return;
    if (!confirm("Excluir campanha?")) return;
    try {
      await deleteBroadcast({
        data: { access_token: accessToken, candidate_id: candidateId, id },
      });
      toast.success("Excluída");
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Campanhas de disparo</h3>
          <p className="text-sm text-muted-foreground">
            Envios em massa com intervalo e proteção anti-banimento.
          </p>
        </div>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nova campanha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <BroadcastWizard
              accessToken={accessToken}
              candidateId={candidateId}
              onCreated={() => {
                setCreating(false);
                load();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {list.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Nenhuma campanha. Clique em "Nova campanha" para começar.
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((b) => {
            const done = b.sent_count + b.failed_count + b.skipped_count;
            const pct = b.total ? Math.round((done / b.total) * 100) : 0;
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold">{b.name}</h4>
                      <StatusBadge status={b.status} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                      {b.message_text}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {(b.status === "draft" || b.status === "paused") && (
                      <Button size="sm" onClick={() => onStart(b.id)}>
                        <Play className="mr-2 h-4 w-4" /> Iniciar
                      </Button>
                    )}
                    {b.status === "running" && (
                      <Button size="sm" variant="outline" onClick={() => onPause(b.id)}>
                        <Pause className="mr-2 h-4 w-4" /> Pausar
                      </Button>
                    )}
                    {b.status !== "running" && (
                      <Button size="icon" variant="ghost" onClick={() => onDelete(b.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>
                      {done}/{b.total} • enviadas {b.sent_count} • falhas{" "}
                      {b.failed_count} • puladas {b.skipped_count}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <Progress value={pct} />
                </div>
                {b.next_send_at && b.status === "running" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Próximo envio: {new Date(b.next_send_at).toLocaleString("pt-BR")}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Broadcast["status"] }) {
  const map: Record<Broadcast["status"], { label: string; cls: string }> = {
    draft: { label: "Rascunho", cls: "bg-muted" },
    running: { label: "Enviando", cls: "bg-green-600 text-white" },
    paused: { label: "Pausada", cls: "bg-amber-500 text-white" },
    completed: { label: "Concluída", cls: "bg-blue-600 text-white" },
    failed: { label: "Falhou", cls: "bg-destructive text-destructive-foreground" },
  };
  const m = map[status];
  return <Badge className={m.cls}>{m.label}</Badge>;
}

/* ============ Wizard ============ */

function BroadcastWizard({
  accessToken,
  candidateId,
  onCreated,
}: {
  accessToken: string | null;
  candidateId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("Olá {nome}! ");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [intMin, setIntMin] = useState(45);
  const [intMax, setIntMax] = useState(120);
  const [cap, setCap] = useState(200);
  const [hourCap, setHourCap] = useState(60);
  const [quiet, setQuiet] = useState(true);
  const [busy, setBusy] = useState(false);

  // Advanced anti-ban
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [windows, setWindows] = useState<Array<{ start: string; end: string }>>([
    { start: "09:00", end: "12:00" },
    { start: "14:00", end: "18:00" },
  ]);
  const [simulateTyping, setSimulateTyping] = useState(true);
  const [longEvery, setLongEvery] = useState(30);
  const [longMin, setLongMin] = useState(300);
  const [longMax, setLongMax] = useState(900);
  const [cooldownH, setCooldownH] = useState(72);
  const [footer, setFooter] = useState(true);
  const [shuffle, setShuffle] = useState(true);
  const [spinPreview, setSpinPreview] = useState(0);


  // Sources
  const [tab, setTab] = useState<"leads" | "contacts" | "groups" | "manual">("leads");
  const [leads, setLeads] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [pickedLeads, setPickedLeads] = useState<Set<string>>(new Set());
  const [pickedContacts, setPickedContacts] = useState<Set<string>>(new Set());
  const [pickedGroups, setPickedGroups] = useState<Set<string>>(new Set());
  const [manualText, setManualText] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [groupFavOnly, setGroupFavOnly] = useState(false);

  useEffect(() => {
    supabase
      .from("voter_leads")
      .select("id, full_name, phone, neighborhood")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false })
      .then(({ data }) => setLeads(data || []));
    supabase
      .from("whatsapp_contacts")
      .select("jid, name, push_name, phone")
      .eq("candidate_id", candidateId)
      .order("name", { ascending: true })
      .then(({ data }) => setContacts(data || []));
    supabase
      .from("whatsapp_groups")
      .select("jid, name, is_favorite, participants_count")
      .eq("candidate_id", candidateId)
      .order("is_favorite", { ascending: false })
      .order("name", { ascending: true })
      .then(({ data }) => setGroups(data || []));
  }, [candidateId]);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${candidateId}/broadcasts/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      setMediaUrls((prev) => [...prev, data.publicUrl].slice(0, 5));
      toast.success("Imagem carregada");
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setUploading(false);
    }
  };


  const recipients = useMemo<Recipient[]>(() => {
    const out: Recipient[] = [];
    if (tab === "leads" || pickedLeads.size > 0) {
      for (const id of pickedLeads) {
        const l = leads.find((x) => x.id === id);
        if (!l?.phone) continue;
        const digits = l.phone.replace(/\D/g, "");
        if (!digits) continue;
        out.push({
          jid: `${normalize(digits)}@s.whatsapp.net`,
          display_name: l.full_name,
          variables: { nome: l.full_name?.split(" ")[0] || "" },
        });
      }
    }
    for (const jid of pickedContacts) {
      const c = contacts.find((x) => x.jid === jid);
      out.push({
        jid,
        display_name: c?.name || c?.push_name || null,
        variables: { nome: (c?.name || c?.push_name || "").split(" ")[0] },
      });
    }
    for (const jid of pickedGroups) {
      const g = groups.find((x) => x.jid === jid);
      out.push({ jid, display_name: g?.name || "Grupo" });
    }
    if (manualText.trim()) {
      for (const line of manualText.split(/[\n,;]/)) {
        const digits = line.replace(/\D/g, "");
        if (digits.length < 8) continue;
        out.push({ jid: `${normalize(digits)}@s.whatsapp.net` });
      }
    }
    // Dedup
    const seen = new Set<string>();
    return out.filter((r) => {
      if (seen.has(r.jid)) return false;
      seen.add(r.jid);
      return true;
    });
  }, [tab, pickedLeads, pickedContacts, pickedGroups, manualText, leads, contacts, groups]);

  const filteredLeads = leads.filter(
    (l) =>
      !leadSearch ||
      (l.full_name || "").toLowerCase().includes(leadSearch.toLowerCase()) ||
      (l.neighborhood || "").toLowerCase().includes(leadSearch.toLowerCase())
  );
  const filteredContacts = contacts.filter(
    (c) =>
      !contactSearch ||
      (c.name || "").toLowerCase().includes(contactSearch.toLowerCase()) ||
      (c.push_name || "").toLowerCase().includes(contactSearch.toLowerCase())
  );
  const filteredGroups = groups.filter((g) => !groupFavOnly || g.is_favorite);

  const targetType = useMemo(() => {
    const flags = [
      pickedLeads.size > 0,
      pickedContacts.size > 0,
      pickedGroups.size > 0,
      manualText.trim() !== "",
    ];
    const count = flags.filter(Boolean).length;
    if (count > 1) return "mixed" as const;
    if (pickedLeads.size > 0) return "leads" as const;
    if (pickedContacts.size > 0) return "contacts" as const;
    if (pickedGroups.size > 0) return "groups" as const;
    return "manual_list" as const;
  }, [pickedLeads, pickedContacts, pickedGroups, manualText]);

  const estTimeMin = useMemo(() => {
    const avg = (intMin + intMax) / 2;
    return Math.ceil((recipients.length * avg) / 60);
  }, [recipients.length, intMin, intMax]);

  const onCreate = async (start: boolean) => {
    if (!accessToken) return;
    if (!name.trim()) return toast.error("Dê um nome à campanha");
    if (!message.trim()) return toast.error("Mensagem vazia");
    if (recipients.length === 0) return toast.error("Sem destinatários");
    if (intMax < intMin) return toast.error("Intervalo inválido");
    if (weekdays.size === 0) return toast.error("Escolha ao menos um dia da semana");
    setBusy(true);
    try {
      const res = await createBroadcast({
        data: {
          access_token: accessToken,
          candidate_id: candidateId,
          name: name.trim(),
          message_text: message,
          media_url: mediaUrls[0] || null,
          media_urls: mediaUrls,
          interval_min_seconds: intMin,
          interval_max_seconds: intMax,
          daily_cap: cap,
          hour_cap: hourCap,
          respect_quiet_hours: quiet,
          allowed_weekdays: Array.from(weekdays).sort(),
          daytime_windows: windows,
          simulate_typing: simulateTyping,
          long_pause_every: longEvery,
          long_pause_seconds_min: longMin,
          long_pause_seconds_max: longMax,
          recipient_cooldown_hours: cooldownH,
          append_optout_footer: footer,
          shuffle_recipients: shuffle,
          target_type: targetType,
          recipients,
        },
      });
      toast.success(`Campanha criada (${res.total} destinatários)`);
      if (start) {
        await startBroadcast({
          data: { access_token: accessToken, candidate_id: candidateId, id: res.id },
        });
        toast.success("Iniciada");
      }
      onCreated();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div>
      <DialogHeader>
        <DialogTitle>Nova campanha de disparo</DialogTitle>
      </DialogHeader>
      <div className="mt-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nome da campanha</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Convite comício" />
          </div>
          <div>
            <Label>Imagens (opcional — até 5, rotação anti-spam)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                    e.target.value = "";
                  }}
                />
                <Button asChild variant="outline" size="sm" disabled={uploading || mediaUrls.length >= 5}>
                  <span>
                    {uploading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="mr-2 h-4 w-4" />
                    )}
                    {mediaUrls.length > 0 ? `+ Adicionar (${mediaUrls.length}/5)` : "Enviar imagem"}
                  </span>
                </Button>
              </label>
              {mediaUrls.map((u, i) => (
                <div key={u} className="relative">
                  <img src={u} alt="" className="h-10 w-10 rounded border object-cover" />
                  <button
                    type="button"
                    onClick={() => setMediaUrls((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1 -top-1 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div>
          <Label>Mensagem (use {"{nome}"} para personalizar)</Label>
          <Textarea
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Olá {nome}! Convido você para..."
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label>Intervalo mín (s)</Label>
            <Input
              type="number"
              min={15}
              value={intMin}
              onChange={(e) => setIntMin(parseInt(e.target.value) || 30)}
            />
          </div>
          <div>
            <Label>Intervalo máx (s)</Label>
            <Input
              type="number"
              min={15}
              value={intMax}
              onChange={(e) => setIntMax(parseInt(e.target.value) || 90)}
            />
          </div>
          <div>
            <Label>Limite diário</Label>
            <Input
              type="number"
              min={10}
              max={1000}
              value={cap}
              onChange={(e) => setCap(parseInt(e.target.value) || 200)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={quiet}
            onCheckedChange={(v) => setQuiet(!!v)}
          />
          Respeitar horário de silêncio configurado na conexão
        </label>

        {/* Spintax preview */}
        {message.match(/\{[^{}]*\|[^{}]*\}/) && (
          <Card className="border-dashed bg-muted/30 p-3">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium">Pré-visualização (variação {spinPreview + 1})</span>
              <Button size="sm" variant="ghost" onClick={() => setSpinPreview((n) => n + 1)}>
                Sortear outra
              </Button>
            </div>
            <p className="whitespace-pre-wrap text-sm">{previewSpintax(message, spinPreview)}</p>
          </Card>
        )}

        <Accordion type="single" collapsible className="rounded-lg border">
          <AccordionItem value="adv" className="border-0">
            <AccordionTrigger className="px-4">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Shield className="h-4 w-4" /> Proteção anti-banimento (avançado)
              </span>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 px-4 pb-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Limite por hora</Label>
                  <Input
                    type="number"
                    min={5}
                    max={500}
                    value={hourCap}
                    onChange={(e) => setHourCap(parseInt(e.target.value) || 60)}
                  />
                </div>
                <div>
                  <Label>Cooldown por destinatário (h)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={720}
                    value={cooldownH}
                    onChange={(e) => setCooldownH(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              <div>
                <Label>Dias da semana permitidos</Label>
                <div className="mt-2 flex flex-wrap gap-1">
                  {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((d, i) => {
                    const active = weekdays.has(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() =>
                          setWeekdays((prev) => {
                            const n = new Set(prev);
                            if (n.has(i)) n.delete(i);
                            else n.add(i);
                            return n;
                          })
                        }
                        className={`rounded px-3 py-1 text-xs ${
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Janelas de envio (horário de Brasília)</Label>
                <div className="mt-2 space-y-2">
                  {windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={w.start}
                        onChange={(e) =>
                          setWindows((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, start: e.target.value } : x))
                          )
                        }
                        className="w-32"
                      />
                      <span className="text-xs text-muted-foreground">até</span>
                      <Input
                        type="time"
                        value={w.end}
                        onChange={(e) =>
                          setWindows((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, end: e.target.value } : x))
                          )
                        }
                        className="w-32"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setWindows((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {windows.length < 4 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setWindows((prev) => [...prev, { start: "09:00", end: "18:00" }])
                      }
                    >
                      <Plus className="mr-1 h-3 w-3" /> Janela
                    </Button>
                  )}
                  {windows.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Sem janelas = pode enviar a qualquer hora (sujeito ao quiet hours).
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Pausa longa a cada</Label>
                  <Input
                    type="number"
                    min={0}
                    value={longEvery}
                    onChange={(e) => setLongEvery(parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label>Pausa mín (s)</Label>
                  <Input
                    type="number"
                    min={30}
                    value={longMin}
                    onChange={(e) => setLongMin(parseInt(e.target.value) || 300)}
                  />
                </div>
                <div>
                  <Label>Pausa máx (s)</Label>
                  <Input
                    type="number"
                    min={30}
                    value={longMax}
                    onChange={(e) => setLongMax(parseInt(e.target.value) || 900)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={simulateTyping} onCheckedChange={(v) => setSimulateTyping(!!v)} />
                  Simular "digitando…" antes de enviar
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={footer} onCheckedChange={(v) => setFooter(!!v)} />
                  Adicionar rodapé "Responda SAIR para não receber mais"
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={shuffle} onCheckedChange={(v) => setShuffle(!!v)} />
                  Embaralhar ordem dos destinatários
                </label>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Risk score */}
        <RiskScore
          recipientsCount={recipients.length}
          intMin={intMin}
          intMax={intMax}
          hourCap={hourCap}
          cap={cap}
          hasSpintax={!!message.match(/\{[^{}]*\|[^{}]*\}/)}
          hasMedia={mediaUrls.length > 0}
          mediaRotation={mediaUrls.length > 1}
          windows={windows}
          cooldown={cooldownH}
        />


        <div>
          <Label>Destinatários</Label>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mt-2">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="leads">Eleitores ({pickedLeads.size})</TabsTrigger>
              <TabsTrigger value="contacts">Contatos ({pickedContacts.size})</TabsTrigger>
              <TabsTrigger value="groups">Grupos ({pickedGroups.size})</TabsTrigger>
              <TabsTrigger value="manual">Lista manual</TabsTrigger>
            </TabsList>
            <TabsContent value="leads">
              <div className="space-y-2">
                <Input
                  placeholder="Buscar nome ou bairro…"
                  value={leadSearch}
                  onChange={(e) => setLeadSearch(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPickedLeads(new Set(filteredLeads.map((l) => l.id)))}
                  >
                    Selecionar todos ({filteredLeads.length})
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPickedLeads(new Set())}>
                    Limpar
                  </Button>
                </div>
                <ScrollArea className="h-64 rounded border">
                  {filteredLeads.map((l) => (
                    <label
                      key={l.id}
                      className="flex items-center gap-2 border-b px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={pickedLeads.has(l.id)}
                        onCheckedChange={(v) => {
                          setPickedLeads((prev) => {
                            const n = new Set(prev);
                            if (v) n.add(l.id);
                            else n.delete(l.id);
                            return n;
                          });
                        }}
                      />
                      <span className="flex-1">
                        <strong>{l.full_name}</strong>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {l.phone} • {l.neighborhood}
                        </span>
                      </span>
                    </label>
                  ))}
                </ScrollArea>
              </div>
            </TabsContent>
            <TabsContent value="contacts">
              <div className="space-y-2">
                <Input
                  placeholder="Buscar contato…"
                  value={contactSearch}
                  onChange={(e) => setContactSearch(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPickedContacts(new Set(filteredContacts.map((c) => c.jid)))
                    }
                  >
                    Selecionar todos
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPickedContacts(new Set())}>
                    Limpar
                  </Button>
                </div>
                <ScrollArea className="h-64 rounded border">
                  {filteredContacts.map((c) => (
                    <label
                      key={c.jid}
                      className="flex items-center gap-2 border-b px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={pickedContacts.has(c.jid)}
                        onCheckedChange={(v) => {
                          setPickedContacts((prev) => {
                            const n = new Set(prev);
                            if (v) n.add(c.jid);
                            else n.delete(c.jid);
                            return n;
                          });
                        }}
                      />
                      <span className="flex-1">
                        {c.name || c.push_name || c.jid}
                        <span className="ml-2 text-xs text-muted-foreground">{c.phone}</span>
                      </span>
                    </label>
                  ))}
                  {filteredContacts.length === 0 && (
                    <p className="p-4 text-center text-sm text-muted-foreground">
                      Nenhum contato. Sincronize na aba conversas.
                    </p>
                  )}
                </ScrollArea>
              </div>
            </TabsContent>
            <TabsContent value="groups">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={groupFavOnly} onCheckedChange={(v) => setGroupFavOnly(!!v)} />
                  Apenas favoritos
                </label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPickedGroups(new Set(filteredGroups.map((g) => g.jid)))}
                  >
                    Selecionar todos
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPickedGroups(new Set())}>
                    Limpar
                  </Button>
                </div>
                <ScrollArea className="h-64 rounded border">
                  {filteredGroups.map((g) => (
                    <label
                      key={g.jid}
                      className="flex items-center gap-2 border-b px-3 py-2 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={pickedGroups.has(g.jid)}
                        onCheckedChange={(v) => {
                          setPickedGroups((prev) => {
                            const n = new Set(prev);
                            if (v) n.add(g.jid);
                            else n.delete(g.jid);
                            return n;
                          });
                        }}
                      />
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1">
                        {g.name || g.jid}
                        {g.is_favorite && <span className="ml-1 text-yellow-500">★</span>}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {g.participants_count} membros
                        </span>
                      </span>
                    </label>
                  ))}
                </ScrollArea>
              </div>
            </TabsContent>
            <TabsContent value="manual">
              <Textarea
                rows={8}
                placeholder="Um número por linha. Ex: 67999999999"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
              />
            </TabsContent>
          </Tabs>
        </div>

        <Card className="bg-muted/30 p-4">
          <div className="flex items-center justify-between text-sm">
            <div>
              <strong>{recipients.length}</strong> destinatário(s) únicos
            </div>
            <div className="text-muted-foreground">
              Tempo estimado: ~{estTimeMin} min
            </div>
          </div>
        </Card>
      </div>
      <DialogFooter className="mt-4 gap-2">
        <Button variant="outline" onClick={() => onCreate(false)} disabled={busy}>
          Salvar rascunho
        </Button>
        <Button onClick={() => onCreate(true)} disabled={busy}>
          {busy ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          Criar e iniciar
        </Button>
      </DialogFooter>
    </div>
  );
}

function normalize(digits: string): string {
  let d = digits;
  if (d.startsWith("0")) d = d.slice(1);
  if (!d.startsWith("55")) d = "55" + d;
  const ddd = d.slice(2, 4);
  let num = d.slice(4);
  if (num.length === 8) num = "9" + num;
  return "55" + ddd + num;
}
