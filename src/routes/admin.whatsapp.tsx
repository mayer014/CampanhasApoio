import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAccessToken } from "@/hooks/use-access-token";
import { adminListInstances } from "@/lib/whatsapp.functions";
import { ConnectionPanel } from "@/components/whatsapp/ConnectionPanel";
import { ChatPanel } from "@/components/whatsapp/ChatPanel";
import { GroupsPanel } from "@/components/whatsapp/GroupsPanel";
import { BroadcastsPanel } from "@/components/whatsapp/BroadcastsPanel";
import { OptOutsPanel } from "@/components/whatsapp/OptOutsPanel";

export const Route = createFileRoute("/admin/whatsapp")({
  component: AdminWhatsApp,
});

function AdminWhatsApp() {
  const token = useAccessToken();
  const [list, setList] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    adminListInstances({ data: { access_token: token } })
      .then((r) => setList(r))
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, [token]);

  const sel = list.find((i) => i.candidate_id === selected);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold">WhatsApp — Administração</h1>
        <p className="mt-1 text-muted-foreground">
          Veja todas as instâncias dos candidatos e administre quando necessário.
        </p>
      </div>

      {!selected ? (
        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando…</div>
          ) : list.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum candidato conectou o WhatsApp ainda.
            </div>
          ) : (
            <div className="divide-y">
              {list.map((i) => (
                <button
                  key={i.id}
                  onClick={() => setSelected(i.candidate_id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent"
                >
                  <div>
                    <div className="font-medium">{i.candidate?.full_name || "—"}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.candidate?.email} • {i.phone_number || "sem número"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      hoje: {i.sent_today}/{i.daily_cap}
                    </span>
                    <Badge
                      className={
                        i.status === "connected"
                          ? "bg-green-600 text-white"
                          : i.status === "connecting"
                          ? "bg-amber-500 text-white"
                          : "bg-muted"
                      }
                    >
                      {i.status}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                ← Voltar
              </Button>
              <span className="ml-2 font-semibold">
                Operando como: {sel?.candidate?.full_name}
              </span>
            </div>
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
              <ConnectionPanel accessToken={token} candidateId={selected} defaultName={sel?.candidate?.full_name || "WhatsApp"} />
            </TabsContent>
            <TabsContent value="conversas" className="mt-4">
              <ChatPanel accessToken={token} candidateId={selected} />
            </TabsContent>
            <TabsContent value="grupos" className="mt-4">
              <GroupsPanel accessToken={token} candidateId={selected} />
            </TabsContent>
            <TabsContent value="disparos" className="mt-4">
              <BroadcastsPanel accessToken={token} candidateId={selected} />
            </TabsContent>
            <TabsContent value="bloqueios" className="mt-4">
              <OptOutsPanel accessToken={token} candidateId={selected} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
