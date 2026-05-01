import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download } from "lucide-react";

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("voter_leads")
      .select("id, full_name, phone, street, number, neighborhood, created_at")
      .eq("candidate_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setLeads(data ?? []));
  }, [user]);

  const exportCSV = () => {
    const header = ["Nome", "Telefone", "Rua", "Número", "Bairro", "Data"].join(",");
    const rows = leads.map((l) =>
      [l.full_name, l.phone, l.street, l.number, l.neighborhood, new Date(l.created_at).toLocaleString("pt-BR")]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `eleitores-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Eleitores</h1>
          <p className="mt-1 text-muted-foreground">{leads.length} contatos coletados</p>
        </div>
        <Button onClick={exportCSV} disabled={leads.length === 0}>
          <Download className="mr-2 h-4 w-4" /> Exportar CSV
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
