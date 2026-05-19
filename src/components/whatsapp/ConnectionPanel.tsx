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

  const fetchStatus = async () => {
    if (!accessToken) return;
    try {
      const res = await getInstanceStatus({
        data: { access_token: accessToken, candidate_id: candidateId },
      });
      if (!res.configured) {
        setConfigured(false);
        setStatus("disconnected");
        return;
      }
      setConfigured(true);
      setStatus(res.status);
      setQrcode(res.qrcode);
      setPhone(res.phone_number);
    } catch (e: any) {
      // Not configured yet
      setConfigured(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) return;
    fetchStatus();
    // Load instance settings
    import("@/integrations/supabase/client").then(({ supabase }) =>
      supabase
        .from("whatsapp_instances")
        .select("daily_cap, quiet_hours_start, quiet_hours_end")
        .eq("candidate_id", candidateId ?? undefined)
        .maybeSingle()
        .then(({ data }: any) => {
          if (data) {
            setDailyCap(data.daily_cap);
            setQuietStart(data.quiet_hours_start);
            setQuietEnd(data.quiet_hours_end);
          }
        })
    );
  }, [accessToken, candidateId]);

  // Poll status when connecting
  useEffect(() => {
    if (status !== "connecting") return;
    const t = setInterval(fetchStatus, 3000);
    return () => clearInterval(t);
  }, [status, accessToken]);

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
      setQrcode(res.qrcode);
      // start polling
      setTimeout(fetchStatus, 1500);
    } catch (e: any) {
      toast.error(e?.message || "Falha ao criar instância");
    } finally {
      setBusy(false);
    }
  };

  const onReconnect = async () => {
    if (!accessToken) return;
    setBusy(true);
    try {
      await reconnectInstance({
        data: { access_token: accessToken, candidate_id: candidateId },
      });
      toast.success("Reconectando…");
      setTimeout(fetchStatus, 1500);
    } catch (e: any) {
      toast.error(e?.message || "Falha");
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
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold">Status da conexão</h3>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge status={configured ? status : "disconnected"} />
              {phone && (
                <span className="text-sm text-muted-foreground">📱 {phone}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {!configured && (
              <Button onClick={onConnect} disabled={busy}>
                <Plug className="mr-2 h-4 w-4" /> Conectar WhatsApp
              </Button>
            )}
            {configured && status !== "connected" && (
              <Button onClick={onReconnect} disabled={busy}>
                <PlugZap className="mr-2 h-4 w-4" /> Reconectar
              </Button>
            )}
            {configured && (
              <Button variant="outline" onClick={fetchStatus} disabled={busy}>
                <RefreshCw className="mr-2 h-4 w-4" /> Atualizar
              </Button>
            )}
            {configured && status === "connected" && (
              <Button variant="destructive" onClick={onDisconnect} disabled={busy}>
                Desconectar
              </Button>
            )}
          </div>
        </div>

        {qrcode && status === "connecting" && (
          <div className="mt-6 flex flex-col items-center gap-3 rounded-lg border bg-muted/30 p-6">
            <p className="text-sm font-medium">Abra o WhatsApp → Aparelhos conectados → Conectar um aparelho e escaneie:</p>
            <img src={qrcode} alt="QR Code" className="h-64 w-64" />
            <p className="text-xs text-muted-foreground">Atualizando automaticamente…</p>
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
