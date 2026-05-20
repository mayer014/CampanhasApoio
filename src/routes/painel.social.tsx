import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAccessToken } from "@/hooks/use-access-token";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SocialProfilesPanel } from "@/components/social/SocialProfilesPanel";
import { SocialAlertsPanel } from "@/components/social/SocialAlertsPanel";
import { SocialOpsPanel } from "@/components/social/SocialOpsPanel";

export const Route = createFileRoute("/painel/social")({
  component: PainelSocial,
});

function PainelSocial() {
  const { user } = useAuth();
  const token = useAccessToken();
  const [activeTab, setActiveTab] = useState<"ops" | "profiles" | "alerts">("ops");
  if (!user) return <div className="text-muted-foreground">Carregando…</div>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Inteligência Social</h1>
        <p className="mt-1 text-muted-foreground">
          Monitore perfis públicos do Instagram: seu candidato, concorrentes, portais e influenciadores.
        </p>
      </div>
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="ops">Operação</TabsTrigger>
          <TabsTrigger value="profiles">Perfis monitorados</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>
        <TabsContent value="ops" className="mt-4">
          {activeTab === "ops" ? <SocialOpsPanel accessToken={token} /> : null}
        </TabsContent>
        <TabsContent value="profiles" className="mt-4">
          {activeTab === "profiles" ? <SocialProfilesPanel accessToken={token} /> : null}
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          {activeTab === "alerts" ? <SocialAlertsPanel accessToken={token} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
