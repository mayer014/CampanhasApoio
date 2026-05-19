import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useAccessToken } from "@/hooks/use-access-token";
import { ConnectionPanel } from "@/components/whatsapp/ConnectionPanel";
import { ChatPanel } from "@/components/whatsapp/ChatPanel";
import { GroupsPanel } from "@/components/whatsapp/GroupsPanel";
import { BroadcastsPanel } from "@/components/whatsapp/BroadcastsPanel";
import { OptOutsPanel } from "@/components/whatsapp/OptOutsPanel";

export const Route = createFileRoute("/painel/whatsapp")({
  component: PainelWhatsApp,
});

function PainelWhatsApp() {
  const { user } = useAuth();
  const token = useAccessToken();
  if (!user) return <div className="text-muted-foreground">Carregando…</div>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp</h1>
        <p className="mt-1 text-muted-foreground">
          Conecte sua conta, converse e dispare mensagens em massa.
        </p>
      </div>
      <Tabs defaultValue="conexao">
        <TabsList>
          <TabsTrigger value="conexao">Conexão</TabsTrigger>
          <TabsTrigger value="conversas">Conversas</TabsTrigger>
          <TabsTrigger value="grupos">Grupos</TabsTrigger>
          <TabsTrigger value="disparos">Disparos</TabsTrigger>
          <TabsTrigger value="bloqueios">Bloqueios</TabsTrigger>
        </TabsList>
        <TabsContent value="conexao" className="mt-4">
          <ConnectionPanel accessToken={token} candidateId={user.id} defaultName={`WhatsApp ${user.email}`} />
        </TabsContent>
        <TabsContent value="conversas" className="mt-4">
          <ChatPanel accessToken={token} candidateId={user.id} />
        </TabsContent>
        <TabsContent value="grupos" className="mt-4">
          <GroupsPanel accessToken={token} candidateId={user.id} />
        </TabsContent>
        <TabsContent value="disparos" className="mt-4">
          <BroadcastsPanel accessToken={token} candidateId={user.id} />
        </TabsContent>
        <TabsContent value="bloqueios" className="mt-4">
          <OptOutsPanel accessToken={token} candidateId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
