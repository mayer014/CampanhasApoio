
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { resolveClientId } from "@/lib/resolve-client-id";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AIMissionsPanel } from "@/components/social/AIMissionsPanel";
import { PortalMissionsPanel } from "@/components/social/PortalMissionsPanel";
import { Sparkles, LayoutList } from "lucide-react";

export const Route = createFileRoute("/painel/missoes-ia")({
  component: MissoesIA,
});

function MissoesIA() {
  const [clientId, setClientId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    resolveClientId().then(id => {
      setClientId(id);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-center">Carregando...</div>;
  if (!clientId) return <div className="p-8 text-center">Nenhum cliente vinculado.</div>;

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Missões Inteligentes</h1>
        </div>
        <p className="text-muted-foreground">
          Crie engajamento real nas suas redes sociais através de missões sugeridas por IA.
        </p>
      </div>

      <Tabs defaultValue="suggestions" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="suggestions" className="gap-2">
            <Sparkles className="h-4 w-4" /> Sugestões da IA
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-2">
            <LayoutList className="h-4 w-4" /> Missões Ativas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions">
          <AIMissionsPanel clientId={clientId} />
        </TabsContent>

        <TabsContent value="active">
          <PortalMissionsPanel clientId={clientId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
