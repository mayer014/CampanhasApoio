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
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      wb.creator = "Foto de Campanha";
      wb.created = new Date();

      const ws = wb.addWorksheet("Eleitores", {
        views: [{ state: "frozen", ySplit: 4 }],
      });

      // Title
      ws.mergeCells("A1:F1");
      const title = ws.getCell("A1");
      title.value = `Eleitores cadastrados — ${profileName || "Campanha"}`;
      title.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
      title.alignment = { vertical: "middle", horizontal: "center" };
      title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      ws.getRow(1).height = 32;

      // Subtitle
      ws.mergeCells("A2:F2");
      const sub = ws.getCell("A2");
      sub.value = `Total: ${leads.length} eleitores · Exportado em ${new Date().toLocaleString("pt-BR")}`;
      sub.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };
      sub.alignment = { vertical: "middle", horizontal: "center" };
      sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
      ws.getRow(2).height = 22;

      // Empty row spacer
      ws.getRow(3).height = 6;

      // Header row
      const headerRow = ws.getRow(4);
      const headers = ["Nome", "Telefone", "Rua", "Número", "Bairro", "Data do cadastro"];
      headers.forEach((h, i) => {
        const cell = headerRow.getCell(i + 1);
        cell.value = h;
        cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { vertical: "middle", horizontal: "left" };
        cell.border = {
          top: { style: "thin", color: { argb: "FF334155" } },
          bottom: { style: "thin", color: { argb: "FF334155" } },
          left: { style: "thin", color: { argb: "FF334155" } },
          right: { style: "thin", color: { argb: "FF334155" } },
        };
      });
      headerRow.height = 26;

      // Data rows
      leads.forEach((l, idx) => {
        const row = ws.addRow([
          l.full_name,
          l.phone,
          l.street,
          l.number,
          l.neighborhood,
          new Date(l.created_at),
        ]);
        const isAlt = idx % 2 === 1;
        row.eachCell((cell, colNum) => {
          cell.font = { name: "Calibri", size: 11, color: { argb: "FF0F172A" } };
          cell.alignment = { vertical: "middle", horizontal: "left" };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isAlt ? "FFF8FAFC" : "FFFFFFFF" },
          };
          cell.border = {
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
          };
          if (colNum === 6) {
            cell.numFmt = "dd/mm/yyyy hh:mm";
          }
        });
        row.height = 22;
      });

      // Column widths
      ws.columns = [
        { width: 28 },
        { width: 18 },
        { width: 32 },
        { width: 10 },
        { width: 22 },
        { width: 22 },
      ];

      // Auto filter on header
      ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 6 } };

      // Sheet 2: Resumo por bairro
      const wsSum = wb.addWorksheet("Resumo por bairro");
      const counts = new Map<string, number>();
      leads.forEach((l) => {
        const k = l.neighborhood?.trim() || "—";
        counts.set(k, (counts.get(k) ?? 0) + 1);
      });
      const summary = Array.from(counts, ([bairro, total]) => ({ bairro, total })).sort((a, b) => b.total - a.total);

      wsSum.mergeCells("A1:B1");
      const sTitle = wsSum.getCell("A1");
      sTitle.value = "Eleitores por bairro";
      sTitle.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
      sTitle.alignment = { horizontal: "center", vertical: "middle" };
      sTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
      wsSum.getRow(1).height = 28;

      const sHead = wsSum.getRow(2);
      sHead.values = ["Bairro", "Total"];
      sHead.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E293B" } };
        cell.alignment = { horizontal: "left", vertical: "middle" };
      });
      sHead.height = 22;

      summary.forEach((s, i) => {
        const r = wsSum.addRow([s.bairro, s.total]);
        const isAlt = i % 2 === 1;
        r.eachCell((cell) => {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: isAlt ? "FFF8FAFC" : "FFFFFFFF" },
          };
          cell.border = { bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };
        });
      });

      // Total row
      const totalRow = wsSum.addRow(["TOTAL", leads.length]);
      totalRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22C55E" } };
      });

      wsSum.columns = [{ width: 32 }, { width: 12 }];

      // Save
      const buf = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `eleitores-${(profileName || "campanha").toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
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
