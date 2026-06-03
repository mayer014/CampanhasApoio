
import { createFileRoute } from "@tanstack/react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { useAccessToken } from "@/hooks/use-access-token";
import { ConnectionPanel } from "@/components/whatsapp/ConnectionPanel";
import { ChatPanel } from "@/components/whatsapp/ChatPanel";
import { GroupsPanel } from "@/components/whatsapp/GroupsPanel";
import { OptOutsPanel } from "@/components/whatsapp/OptOutsPanel";
import { MessageSquare, Send, Sparkles, Settings, Users, ShieldAlert, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getInstanceStatus } from "@/lib/whatsapp.functions";

// Components from our other pages
import { AIMissionsPanel } from "@/components/social/AIMissionsPanel";
import { PortalMissionsPanel } from "@/components/social/PortalMissionsPanel";
import DisparosTab from "@/components/social/DisparosTab";

export const Route = createFileRoute("/painel/central-whatsapp")({
  component: CentralWhatsApp,
});

function CentralWhatsApp() {
  const { user } = useAuth();
  const token = useAccessToken();
  const [activeTab, setActiveTab] = useState<string>("disparos");
  const [checkingConnection, setCheckingConnection] = useState(true);

  useEffect(() => {
    if (!token || !user) return;
    
    const checkInitialConnection = async () => {
      try {
        const res = await getInstanceStatus({
          data: { access_token: token, candidate_id: user.id },
        });
        if (!res.configured || res.status !== "connected") {
          setActiveTab("conexao");
        }
      } catch (e) {
        setActiveTab("conexao");
      } finally {
        setCheckingConnection(false);
      }
    };

    checkInitialConnection();
  }, [token, user]);

  if (!user || checkingConnection) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin mb-4" />
        <p>Carregando Central de WhatsApp…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Central de WhatsApp</h1>
        <p className="mt-1 text-muted-foreground">
          Gestão completa de comunicação, engajamento e automação.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 mb-8 h-auto flex-wrap">
          <TabsTrigger value="disparos" className="gap-2 py-3">
            <Send className="h-4 w-4" /> <span className="hidden md:inline">Disparos</span>
          </TabsTrigger>
          <TabsTrigger value="missoes" className="gap-2 py-3">
            <Sparkles className="h-4 w-4" /> <span className="hidden md:inline">Missões IA</span>
          </TabsTrigger>
          <TabsTrigger value="conversas" className="gap-2 py-3">
            <MessageSquare className="h-4 w-4" /> <span className="hidden md:inline">Conversas</span>
          </TabsTrigger>
          <TabsTrigger value="grupos" className="gap-2 py-3">
            <Users className="h-4 w-4" /> <span className="hidden md:inline">Grupos</span>
          </TabsTrigger>
          <TabsTrigger value="conexao" className="gap-2 py-3">
            <Settings className="h-4 w-4" /> <span className="hidden md:inline">Conexão</span>
          </TabsTrigger>
          <TabsTrigger value="bloqueios" className="gap-2 py-3">
            <ShieldAlert className="h-4 w-4" /> <span className="hidden md:inline">Bloqueios</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="disparos" className="mt-0">
          <DisparosTab clientId={user.id} />
        </TabsContent>

        <TabsContent value="missoes" className="mt-0 space-y-12">
          <AIMissionsPanel clientId={user.id} />
          <div className="h-px bg-border my-8" />
          <PortalMissionsPanel clientId={user.id} />
        </TabsContent>

        <TabsContent value="conversas" className="mt-0">
          <ChatPanel accessToken={token} candidateId={user.id} />
        </TabsContent>

        <TabsContent value="grupos" className="mt-0">
          <GroupsPanel accessToken={token} candidateId={user.id} />
        </TabsContent>

        <TabsContent value="conexao" className="mt-0">
          <ConnectionPanel accessToken={token} candidateId={user.id} defaultName={`WhatsApp ${user.email}`} />
        </TabsContent>

        <TabsContent value="bloqueios" className="mt-0">
          <OptOutsPanel accessToken={token} candidateId={user.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
