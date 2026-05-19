import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { addOptOut, removeOptOut } from "@/lib/whatsapp.functions";

type OptOut = {
  id: string;
  jid: string;
  reason: string | null;
  created_at: string;
};

export function OptOutsPanel({
  accessToken,
  candidateId,
}: {
  accessToken: string | null;
  candidateId: string;
}) {
  const [list, setList] = useState<OptOut[]>([]);
  const [newJid, setNewJid] = useState("");
  const [newReason, setNewReason] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("whatsapp_optouts")
      .select("*")
      .eq("candidate_id", candidateId)
      .order("created_at", { ascending: false });
    setList((data || []) as any);
  };
  useEffect(() => {
    load();
  }, [candidateId]);

  const add = async () => {
    if (!accessToken || !newJid.trim()) return;
    let jid = newJid.trim();
    if (!jid.includes("@")) {
      const digits = jid.replace(/\D/g, "");
      jid = `${digits}@s.whatsapp.net`;
    }
    try {
      await addOptOut({
        data: {
          access_token: accessToken,
          candidate_id: candidateId,
          jid,
          reason: newReason || undefined,
        },
      });
      setNewJid("");
      setNewReason("");
      toast.success("Adicionado");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  };

  const remove = async (id: string) => {
    if (!accessToken) return;
    try {
      await removeOptOut({
        data: { access_token: accessToken, candidate_id: candidateId, id },
      });
      toast.success("Removido");
      load();
    } catch (e: any) {
      toast.error(e?.message || "Falha");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h3 className="text-sm font-semibold">Adicionar bloqueio</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Números nesta lista nunca recebem disparos. Use sempre que alguém pedir para parar.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="Telefone ou JID (ex: 5567999999999)"
            value={newJid}
            onChange={(e) => setNewJid(e.target.value)}
          />
          <Input
            placeholder="Motivo (opcional)"
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
          />
          <Button onClick={add}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>JID</TableHead>
              <TableHead>Motivo</TableHead>
              <TableHead>Data</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum bloqueio
                </TableCell>
              </TableRow>
            ) : (
              list.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.jid}</TableCell>
                  <TableCell>{o.reason || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => remove(o.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
