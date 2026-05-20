import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useAccessToken } from "@/hooks/use-access-token";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SocialProfilesPanel } from "@/components/social/SocialProfilesPanel";
import { SocialAlertsPanel } from "@/components/social/SocialAlertsPanel";

export const Route = createFileRoute("/painel/social")({
  component: PainelSocial,
});

function PainelSocial() {
  const { user } = useAuth();
  const token = useAccessToken();
  if (!user) return <div className="text-muted-foreground">Carregando…</div>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">Inteligência Social</h1>
        <p className="mt-1 text-muted-foreground">
          Monitore perfis públicos do Instagram: seu candidato, concorrentes, portais e influenciadores.
        </p>
      </div>
      <Tabs defaultValue="profiles">
        <TabsList>
          <TabsTrigger value="profiles">Perfis monitorados</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>
        <TabsContent value="profiles" className="mt-4">
          <SocialProfilesPanel accessToken={token} />
        </TabsContent>
        <TabsContent value="alerts" className="mt-4">
          <SocialAlertsPanel accessToken={token} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
