import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";
import { toast } from "sonner";

type Lead = {
  id: string;
  full_name: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  created_at: string;
};

export const Route = createFileRoute("/painel/leads")({
  component: LeadsPage,
});

function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [profileName, setProfileName] = useState<string>("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from("voter_leads")
        .select("id, full_name, phone, street, number, neighborhood, created_at")
        .eq("candidate_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("candidate_profiles").select("full_name").eq("id", user.id).single(),
    ]).then(([{ data: ls }, { data: p }]) => {
      setLeads(ls ?? []);
      setProfileName(p?.full_name ?? "");
    });
  }, [user]);

  const exportXLSX = async () => {
    if (leads.length === 0) return;
    setExporting(true);
    try {
      const { exportLeadsXLSX } = await import("@/lib/export-leads");
      await exportLeadsXLSX(leads, profileName);
      toast.success("Planilha gerada!");
    } catch (e) {
      toast.error("Erro ao exportar: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Eleitores</h1>
          <p className="mt-1 text-muted-foreground">{leads.length} contatos coletados</p>
        </div>
        <Button onClick={exportXLSX} disabled={leads.length === 0 || exporting}>
          <Download className="mr-2 h-4 w-4" /> {exporting ? "Gerando..." : "Exportar Excel"}
        </Button>
      </div>

      <Card className="mt-6 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Endereço</TableHead>
              <TableHead>Bairro</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nenhum eleitor ainda</TableCell></TableRow>
            ) : leads.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="font-medium">{l.full_name}</TableCell>
                <TableCell>{l.phone}</TableCell>
                <TableCell>{l.street}, {l.number}</TableCell>
                <TableCell>{l.neighborhood}</TableCell>
                <TableCell className="text-muted-foreground">{new Date(l.created_at).toLocaleDateString("pt-BR")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
