import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import { SocialProfilesPanel } from "@/components/social/SocialProfilesPanel";
import { SocialAlertsPanel } from "@/components/social/SocialAlertsPanel";
import { SocialOpsPanel } from "@/components/social/SocialOpsPanel";
import { getSocialDiagnostics } from "@/lib/social.functions";
import { withSocialAuth, getSocialErrorMessage } from "@/lib/social-client";

export const Route = createFileRoute("/painel/social")({
  component: PainelSocial,
});

function PainelSocial() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<"ops" | "profiles" | "alerts">("ops");
  const [diag, setDiag] = useState<any>(null);
  const [diagError, setDiagError] = useState<string | null>(null);
  const diagnose = useServerFn(getSocialDiagnostics);

  const ready = !!user;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const r: any = await withSocialAuth((options) => diagnose(options));
        if (!cancelled) {
          setDiag(r);
          setDiagError(null);
        }
      } catch (e: any) {
        if (!cancelled) setDiagError(getSocialErrorMessage(e) || "Falha ao diagnosticar");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, diagnose]);

  if (loading) return <div className="text-muted-foreground">Carregando…</div>;
  if (!user) return <div className="text-muted-foreground">Sessão necessária.</div>;

  // Banner só aparece quando há falha real (não usar env como gatilho — gerava falso positivo).
  const rpcBroken = diag && diag.checks?.dashboard_rpc?.ok === false;
  const profilesBroken = diag && diag.checks?.profiles_table?.ok === false;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Inteligência Social</h1>
        <p className="mt-1 text-muted-foreground">
          Monitore perfis públicos do Instagram: seu candidato, concorrentes, portais e influenciadores.
        </p>
      </div>

      {(rpcBroken || profilesBroken) && (
        <Card className="border-destructive/50">
          <CardContent className="pt-4 flex items-start gap-3">
            <AlertTriangle className="text-destructive shrink-0 mt-0.5 h-5 w-5" />
            <div className="text-sm space-y-1">
              <div className="font-semibold text-destructive">Diagnóstico do módulo</div>
              {profilesBroken && (
                <div className="text-muted-foreground">
                  Falha ao acessar <code>social_profiles</code>:{" "}
                  {diag?.checks?.profiles_table?.message || "sem detalhes"}
                </div>
              )}
              {rpcBroken && (
                <div className="text-muted-foreground">
                  RPC <code>social_dashboard_stats</code> indisponível:{" "}
                  {diag?.checks?.dashboard_rpc?.message || "sem detalhes"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="ops">Operação</TabsTrigger>
          <TabsTrigger value="profiles">Perfis monitorados</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>
        <TabsContent value="ops" className="mt-4">
          {activeTab === "ops" ? <SocialOpsPanel ready={ready} /> : null}
        </TabsContent>
        <TabsContent value="profiles" className="mt-4">
          {activeTab === "profiles" ? <SocialProfilesPanel ready={ready} /> : null}
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          {activeTab === "alerts" ? <SocialAlertsPanel ready={ready} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
