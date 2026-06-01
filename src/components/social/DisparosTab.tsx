
import { useEffect, useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  Image as ImageIcon, 
  History, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Loader2, 
  MessageSquare,
  Sparkles,
  Eye
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DispatchLogDialog } from "@/components/social/DispatchLogDialog";

const SENDING_POLICIES = {
  conservadora: { batch_size: 10, delay_min: 15, delay_max: 30, batch_pause: 120, label: "Conservadora (Mais seguro)" },
  equilibrada: { batch_size: 25, delay_min: 8, delay_max: 15, batch_pause: 60, label: "Equilibrada (Recomendado)" },
  agressiva: { batch_size: 50, delay_min: 3, delay_max: 8, batch_pause: 30, label: "Agressiva (Rápido)" },
};

export default function DisparosTab({ clientId }: { clientId: string }) {
  const queryClient = useQueryClient();
  const [bridgeStatus, setBridgeStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  const [selectedDispatchId, setSelectedDispatchId] = useState<string | null>(null);
  
  // Composer state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [recipientType, setRecipientType] = useState<"tags" | "todos" | "grupos" | "eleicao">("todos");
  const [policy, setPolicy] = useState<keyof typeof SENDING_POLICIES>("equilibrada");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (clientId) checkBridge(clientId);
  }, [clientId]);

  // Realtime updates
  useEffect(() => {
    if (!clientId) return;
    const channel = supabase
      .channel("dispatches_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_dispatches", filter: `client_id=eq.${clientId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["dispatches-history"] });
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [clientId, queryClient]);

  const checkBridge = async (id: string) => {
    try {
      setBridgeStatus('checking');
      const { data, error } = await supabase.functions.invoke("manage-whatsapp-instance", {
        body: { action: "check_bridge", client_id: id }
      });
      if (error) throw error;
      setBridgeStatus(data.status);
    } catch (e) {
      setBridgeStatus('disconnected');
    }
  };

  const { data: missions } = useQuery({
    queryKey: ["active-missions", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("portal_missions").select("*").eq("client_id", clientId).eq("is_active", true);
      return data || [];
    },
    enabled: !!clientId
  });

  const { data: history } = useQuery({
    queryKey: ["dispatches-history", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("whatsapp_dispatches").select("*").eq("client_id", clientId).order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!clientId
  });

  const uploadMedia = async (file: File) => {
    if (!clientId) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 8MB)");
      return;
    }
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${clientId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("whatsapp-media").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      setMediaUrl(publicUrl);
    } catch (error) {
      toast.error("Erro no upload");
    } finally {
      setIsUploading(false);
    }
  };

  const validateMessage = () => {
    const missing = [];
    if (message.toLowerCase().includes("missão") && !message.includes("http")) {
      missing.push("Link do post (URL)");
    }
    return missing;
  };

  const startDispatch = async () => {
    if (!message) return toast.error("Mensagem é obrigatória");
    if (bridgeStatus !== 'connected') return toast.error("WhatsApp desconectado");

    const missingVariables = validateMessage();
    if (missingVariables.length > 0) {
      toast.warning(`Atenção: ${missingVariables.join(", ")} ausente na mensagem.`);
    }

    try {
      const { error } = await supabase.functions.invoke("send-whatsapp-dispatch", {
        body: {
          client_id: clientId,
          titulo: title,
          mensagem: message,
          media_url: mediaUrl,
          tipo: recipientType,
          ...SENDING_POLICIES[policy]
        }
      });
      if (error) throw error;
      toast.success("Disparo enfileirado!");
      setTitle("");
      setMessage("");
      setMediaUrl("");
    } catch (error) {
      toast.error("Erro ao iniciar disparo");
    }
  };

  const fillMissionTemplate = (m: any) => {
    const template = m.whatsapp_template || `🚀 Apoiador(a), temos uma nova missão para você!\n\n*${m.title}*\n${m.description || ""}\n\n👉 ${m.post_url || m.fb_post_url || m.ig_post_url}\n\nSua interação faz diferença. Vamos juntos!`;
    setMessage(template);
    setRecipientType("tags");
    toast.info("Template de missão carregado e público definido como 'Por Tags'");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        <h2 className="text-xl font-semibold">Novo Disparo</h2>
        <Card className={`px-4 py-1.5 flex items-center gap-2 border-none shadow-sm ${bridgeStatus === 'connected' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
          {bridgeStatus === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : 
           bridgeStatus === 'connected' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          <span className="text-sm font-medium">
            Status: {bridgeStatus === 'checking' ? 'Verificando...' : bridgeStatus === 'connected' ? 'Conectado' : 'Desconectado'}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-1" onClick={() => checkBridge(clientId)}>
            <Clock className="h-3 w-3" />
          </Button>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Título do Disparo (Interno)</Label>
                <Input id="title" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Mobilização Bairro Centro" />
              </div>

              <div>
                <Label htmlFor="message">Mensagem Principal</Label>
                <Textarea 
                  id="message" 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  placeholder="Escreva sua mensagem base aqui..." 
                  className="min-h-[120px] font-sans"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                  {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4 mr-2" />}
                  Anexar Imagem
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && uploadMedia(e.target.files[0])} />
                {mediaUrl && (
                  <div className="relative group">
                    <img src={mediaUrl} className="h-10 w-10 object-cover rounded border" alt="preview" />
                    <button className="absolute -top-1 -right-1 bg-destructive text-white rounded-full p-0.5" onClick={() => setMediaUrl("")}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Destinatários</Label>
                  <Select value={recipientType} onValueChange={(v: any) => setRecipientType(v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os Eleitores</SelectItem>
                      <SelectItem value="tags">Por Tags</SelectItem>
                      <SelectItem value="grupos">Grupos de WhatsApp</SelectItem>
                      <SelectItem value="eleicao">Por Zona/Seção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Política de Envio</Label>
                  <Select value={policy} onValueChange={(v: any) => setPolicy(v)}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SENDING_POLICIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <Eye className="h-3 w-3" /> Pré-visualização e Edição Rápida
                </div>
                <div className="bg-white dark:bg-zinc-950 rounded border p-3 text-sm font-sans shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring">
                  {mediaUrl && (
                    <img src={mediaUrl} className="w-full h-32 object-cover rounded mb-2 border" alt="Final preview" />
                  )}
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Nenhuma mensagem escrita..."
                    className="w-full bg-transparent border-none focus:outline-none resize-none min-h-[100px] text-sm"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground italic">
                  * Variáveis como nome do eleitor serão preenchidas no envio.
                </p>
              </div>

              <Button className="w-full" size="lg" onClick={startDispatch} disabled={bridgeStatus !== 'connected' || !message}>
                <Send className="h-4 w-4 mr-2" /> Iniciar Envio em Massa
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Histórico Recente
            </h3>
            <div className="space-y-4">
              {history?.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">Nenhum disparo realizado.</p>
              ) : (
                history?.slice(0, 5).map((d) => (
                  <div key={d.id} className="p-4 border rounded-lg bg-card border-l-4" style={{ borderLeftColor: getStatusColor(d.status) }}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-sm">{d.title || "Sem título"}</h4>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(d.created_at), "PPp", { locale: ptBR })}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase">{d.status.replace('_', ' ')}</Badge>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px]">
                        <span>Progresso: {d.sent_count}/{d.total_count}</span>
                        <span>{Math.round((d.sent_count / (d.total_count || 1)) * 100)}%</span>
                      </div>
                      <Progress value={(d.sent_count / (d.total_count || 1)) * 100} className="h-1" />
                    </div>
                    <div className="flex justify-end gap-2 mt-3">
                      <Button variant="ghost" size="sm" className="h-7 text-[10px]" onClick={() => setSelectedDispatchId(d.id)}>Ver Logs</Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Ativar Missão
            </h3>
            <p className="text-xs text-muted-foreground mb-4">Selecione uma missão para carregar o template.</p>
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {missions?.length === 0 ? (
                <p className="text-center py-4 text-xs text-muted-foreground">Nenhuma missão ativa.</p>
              ) : (
                missions?.map((m) => (
                  <Card key={m.id} className="p-3 bg-muted/50 border-none group hover:bg-muted transition-colors">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-bold truncate">{m.title}</h4>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{m.fb_post_url || m.ig_post_url || m.post_url}</p>
                      </div>
                      <Button variant="secondary" size="icon" className="h-7 w-7 shrink-0" onClick={() => fillMissionTemplate(m)}>
                        <Send className="h-3 w-3" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <DispatchLogDialog 
        dispatchId={selectedDispatchId} 
        open={!!selectedDispatchId} 
        onOpenChange={(open) => !open && setSelectedDispatchId(null)} 
      />
    </div>
  );
}

function getStatusColor(status: string) {
  switch (status) {
    case 'concluido': return '#10b981';
    case 'enviando': return '#3b82f6';
    case 'enfileirado': return '#f59e0b';
    case 'erro':
    case 'cancelado': return '#ef4444';
    default: return '#94a3b8';
  }
}
