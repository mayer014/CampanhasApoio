import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, RefreshCw, Plug, PlugZap } from "lucide-react";
import {
  createInstance,
  getInstanceStatus,
  reconnectInstance,
  disconnectInstance,
  updateInstanceSettings,
} from "@/lib/whatsapp.functions";

export function ConnectionPanel({
  accessToken,
  candidateId,
  defaultName,
}: {
  accessToken: string | null;
  candidateId?: string;
  defaultName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">(
    "disconnected"
  );
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [dailyCap, setDailyCap] = useState(200);
  const [quietStart, setQuietStart] = useState(22);
  const [quietEnd, setQuietEnd] = useState(7);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    if (!accessToken) return;
    try {
      const res = await getInstanceStatus({
        data: { access_token: accessToken, candidate_id: candidateId },
      });
      setErrorMessage(null);
      if (!res.configured) {
        setConfigured(false);
        setStatus("disconnected");
        setQrcode(null);
        return;
      }
      setConfigured(true);
      setStatus(res.status);
      setPhone(res.phone_number);
      
      // Apenas atualizamos o QR Code se ele existir ou se a conexão foi estabelecida/perdida
      if (res.qrcode) {
        setQrcode(res.qrcode);
      } else if (res.status === "connected" || res.status === "disconnected") {
        setQrcode(null);
      }
    } catch (e: any) {
      console.error("[fetchStatus] error:", e);
      const msg = e?.message || "";
      setErrorMessage(msg);
      if (msg.includes("API") || msg.includes("expirada") || msg.includes("inválida") || msg.includes("não encontrada")) {
        setConfigured(false);
        setStatus("disconnected");
        setQrcode(null);
      } else {
        // Não resetamos o status imediatamente em caso de erro transiente
        // para evitar que o QR Code desapareça por uma falha de rede momentânea.
        console.warn("[fetchStatus] Transient error, keeping status:", status);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    fetchStatus();
    // Load instance settings
    (async () => {
      if (!candidateId) return;
      const { supabase } = await import("@/integrations/supabase/client");
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("daily_cap, quiet_hours_start, quiet_hours_end")
        .eq("candidate_id", candidateId)
        .maybeSingle();
      if (data) {
        setDailyCap(data.daily_cap);
        setQuietStart(data.quiet_hours_start);
        setQuietEnd(data.quiet_hours_end);
      }
    })();
  }, [accessToken, candidateId]);


  // Poll status when connecting
  useEffect(() => {
    if (status !== "connecting") return;
    
    // Polling a cada 5 segundos para não sobrecarregar e dar tempo do QR carregar
    const t = setInterval(fetchStatus, 5000);
    return () => clearInterval(t);
  }, [status, accessToken, qrcode]);

  const onConnect = async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      const res = await createInstance({
        data: {
          access_token: accessToken,
          candidate_id: candidateId,
          name: defaultName,
        },
      });
      toast.success(res.reused ? "Instância recuperada" : "Instância criada");
      setConfigured(true);
      setStatus(res.status as any);
      if (res.qrcode) setQrcode(res.qrcode);
      
      // Espera um pouco mais antes da primeira busca para garantir que o motor processou
      setTimeout(fetchStatus, 3000);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar instância");
    } finally {
      setBusy(false);
    }
  };

  const onReconnect = async () => {
    if (!accessToken) return;
    setBusy(true);
    setStatus("connecting"); // Set immediate connecting state
    try {
      await reconnectInstance({
        data: { access_token: accessToken, candidate_id: candidateId },
      });
      toast.success("Reconectando…");
      // start polling
      setTimeout(fetchStatus, 1000);
    } catch (e: any) {
      console.error("[onReconnect] error:", e);
      toast.error(e?.message || "Falha ao reconectar");
      // Importante: se falhou, tentamos atualizar o status real para sair do "connecting"
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    if (!accessToken) return;
    if (!confirm("Desconectar a sessão WhatsApp?")) return;
    setBusy(true);
    try {
      await disconnectInstance({
        data: { access_token: accessToken, candidate_id: candidateId },
      });
      toast.success("Desconectado");
      fetchStatus();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setBusy(false);
    }
  };

  const onReset = async () => {
    if (!accessToken || !candidateId) return;
    if (!confirm("Isso irá limpar os dados da conexão atual e permitir uma nova configuração. Deseja continuar?")) return;
    setBusy(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      await supabase
        .from("whatsapp_instances")
        .update({
          api_key: null,
          instance_id: null,
          status: "disconnected",
          last_qr: null
        })
        .eq("candidate_id", candidateId);
      
      toast.success("Conexão resetada");
      fetchStatus();
    } catch (e: any) {
      toast.error(e?.message || "Falha ao resetar");
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      await updateInstanceSettings({
        data: {
          access_token: accessToken,
          candidate_id: candidateId,
          daily_cap: dailyCap,
          quiet_hours_start: quietStart,
          quiet_hours_end: quietEnd,
        },
      });
      toast.success("Configurações salvas");
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    } finally {
      setBusy(false);
    }
  };

  if (loading)
    return (
      <Card className="p-6">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
      </Card>
    );

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <Card className="p-6 border-primary/20 shadow-lg bg-gradient-to-br from-background to-muted/20">
        <div className="flex flex-col md:flex-row items-start justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-xl font-bold tracking-tight">Conexão do WhatsApp</h3>
            <p className="text-sm text-muted-foreground">
              Vincule seu número para habilitar disparos e automações.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <StatusBadge status={configured ? status : "disconnected"} />
              {phone && (
                <span className="text-sm font-medium bg-muted px-2 py-1 rounded-md border flex items-center gap-2">
                  📱 {phone}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full md:w-auto">
            {!configured && (
              <Button onClick={onConnect} disabled={busy} size="lg" className="w-full md:w-auto shadow-sm">
                <Plug className="mr-2 h-4 w-4" /> Iniciar Nova Conexão
              </Button>
            )}
            {configured && status === "disconnected" && (
              <Button onClick={onReconnect} disabled={busy} size="lg" className="w-full md:w-auto shadow-sm">
                <PlugZap className="mr-2 h-4 w-4" /> Reconectar Agora
              </Button>
            )}
            {configured && status === "connecting" && (
              <Button disabled variant="outline" size="lg" className="w-full md:w-auto">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Conectando…
              </Button>
            )}
            {configured && (
              <Button variant="outline" onClick={fetchStatus} disabled={busy} size="lg" className="w-full md:w-auto">
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar Status
              </Button>
            )}
            {configured && status === "connected" && (
              <Button variant="destructive" onClick={onDisconnect} disabled={busy} size="lg" className="w-full md:w-auto">
                Desconectar WhatsApp
              </Button>
            )}
            {configured && (
              <Button variant="ghost" onClick={onReset} disabled={busy} size="sm" className="text-muted-foreground hover:text-destructive">
                Resetar Dados de Conexão
              </Button>
            )}
          </div>
        </div>

        {status === "connecting" && (
          <div className="mt-8 flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 p-8 text-center animate-in zoom-in-95 duration-300">
            {qrcode ? (
              <>
                <div className="space-y-2 max-w-sm mx-auto">
                  <h4 className="font-bold text-lg">Escaneie o QR Code</h4>
                  <p className="text-sm text-muted-foreground">Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho</p>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-xl border-4 border-white mt-2 ring-1 ring-muted">
                  <img src={qrcode} alt="QR Code" className="h-64 w-64" />
                </div>
                <div className="flex items-center gap-2 text-primary font-medium animate-pulse mt-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <p className="text-sm">Aguardando leitura do QR Code…</p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center py-12 space-y-4">
                <div className="relative">
                  <Loader2 className="h-16 w-16 animate-spin text-primary opacity-20" />
                  <Loader2 className="h-16 w-16 animate-spin text-primary absolute inset-0" style={{ animationDuration: '2s' }} />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-lg">Gerando QR Code…</p>
                  <p className="text-sm text-muted-foreground max-w-[280px]">
                    Estamos preparando sua instância segura. Isso pode levar até 15 segundos.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm flex items-center gap-2">
            <span className="font-bold">Aviso:</span> {errorMessage}
          </div>
        )}
      </Card>

      {configured && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold">Proteção anti-banimento</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Ajuste limites para preservar sua conta. Mudanças bruscas em contas novas aumentam risco de bloqueio.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Limite diário de envios</Label>
              <Input
                type="number"
                min={10}
                max={1000}
                value={dailyCap}
                onChange={(e) => setDailyCap(parseInt(e.target.value) || 200)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Recomendado: 50 (1ª semana) → 200</p>
            </div>
            <div>
              <Label>Silêncio: início</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={quietStart}
                onChange={(e) => setQuietStart(parseInt(e.target.value) || 0)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Hora (0–23, BRT)</p>
            </div>
            <div>
              <Label>Silêncio: fim</Label>
              <Input
                type="number"
                min={0}
                max={23}
                value={quietEnd}
                onChange={(e) => setQuietEnd(parseInt(e.target.value) || 0)}
              />
              <p className="mt-1 text-xs text-muted-foreground">Não envia entre essas horas</p>
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={saveSettings} disabled={busy}>Salvar configurações</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "connected")
    return <Badge className="bg-green-600 hover:bg-green-700">Conectado</Badge>;
  if (status === "connecting")
    return <Badge className="bg-amber-500 hover:bg-amber-600">Conectando…</Badge>;
  return <Badge variant="secondary">Desconectado</Badge>;
}
