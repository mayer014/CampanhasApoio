import { toast } from "sonner";

export type ExportLead = {
  full_name: string;
  phone: string;
  street: string;
  number: string;
  neighborhood: string;
  created_at: string;
};

export async function exportLeadsXLSX(leads: ExportLead[], profileName: string) {
  if (leads.length === 0) {
    toast.info("Nenhum eleitor para exportar");
    return;
  }
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Foto de Campanha";
  wb.created = new Date();

  const ws = wb.addWorksheet("Eleitores", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  ws.mergeCells("A1:F1");
  const title = ws.getCell("A1");
  title.value = `Eleitores cadastrados — ${profileName || "Campanha"}`;
  title.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  title.alignment = { vertical: "middle", horizontal: "center" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  ws.getRow(1).height = 32;

  ws.mergeCells("A2:F2");
  const sub = ws.getCell("A2");
  sub.value = `Total: ${leads.length} eleitores · Exportado em ${new Date().toLocaleString("pt-BR")}`;
  sub.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF475569" } };
  sub.alignment = { vertical: "middle", horizontal: "center" };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  ws.getRow(2).height = 22;

  ws.getRow(3).height = 6;

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

  ws.columns = [
    { width: 28 },
    { width: 18 },
    { width: 32 },
    { width: 10 },
    { width: 22 },
    { width: 22 },
  ];
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 6 } };

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

  const totalRow = wsSum.addRow(["TOTAL", leads.length]);
  totalRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF22C55E" } };
  });
  wsSum.columns = [{ width: 32 }, { width: 12 }];

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
}
