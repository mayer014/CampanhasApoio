import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listSocialAlerts } from "@/lib/social.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Flame, TrendingUp } from "lucide-react";

function readableError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message;
  }
  return "Erro ao carregar alertas";
}

type Alert = {
  id: string;
  alert_type: "viral_post" | "competitor_growth";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string | null;
  payload: any;
  created_at: string;
};

const SEV_VARIANT: Record<Alert["severity"], "default" | "secondary" | "destructive" | "outline"> = {
  info: "secondary",
  warning: "default",
  critical: "destructive",
};

export function SocialAlertsPanel({ ready }: { ready: boolean }) {
  const list = useServerFn(listSocialAlerts);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const r: any = await list({ data: {} });
      if (r?.ok === false) throw new Error(r?.message || "Erro ao carregar alertas");
      setAlerts((r?.alerts ?? []) as Alert[]);
    } catch (e) {
      setAlerts([]);
      toast.error(readableError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (ready) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) return <p className="text-muted-foreground">Carregando sessão…</p>;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Alertas recentes</CardTitle>
        <Button variant="ghost" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </CardHeader>
      <CardContent>
        {alerts.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum alerta ainda. Eles aparecem aqui quando um post viraliza ou um concorrente cresce rápido.
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => {
              const Icon = a.alert_type === "viral_post" ? Flame : TrendingUp;
              return (
                <div key={a.id} className="flex items-start gap-3 rounded-md border bg-card/50 p-3">
                  <Icon className="mt-0.5 h-4 w-4 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{a.title}</span>
                      <Badge variant={SEV_VARIANT[a.severity]} className="text-[10px]">
                        {a.severity}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {a.description && (
                      <div className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {a.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
