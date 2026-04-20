import ExcelJS from "exceljs";
import { NextRequest, NextResponse } from "next/server";

// Soft fill colours per team (ARGB without alpha = RGB hex)
const TEAM_COLORS = [
  "D6EAF8", // light blue
  "D5F5E3", // light green
  "FDEBD0", // light orange
  "F9EBEA", // light rose
  "EBDEF0", // light purple
  "EAFAF1", // mint
  "FFF9C4", // light yellow
  "E8DAEF", // lavender
];

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    athletes: Array<{ name: string; teamName?: string; motherHeightCm?: number | null; fatherHeightCm?: number | null }>;
    selectedTeams: string[];
    isEn: boolean;
  };

  const { athletes, selectedTeams, isEn } = body;

  // Determine ordered list: if teams selected, show only those in order; else all
  const teamOrder = selectedTeams.length > 0 ? selectedTeams : [];
  const showAllTeams = teamOrder.length === 0;

  // Build rows: [{athlete, teamIndex}]
  type RowEntry = { name: string; teamIndex: number; motherHeightCm?: number | null; fatherHeightCm?: number | null };
  const rowEntries: RowEntry[] = [];

  if (showAllTeams) {
    const allTeams = Array.from(new Set(athletes.map((a) => a.teamName ?? ""))).sort();
    allTeams.forEach((team, ti) => {
      athletes
        .filter((a) => (a.teamName ?? "") === team)
        .forEach((a) => rowEntries.push({ name: a.name, teamIndex: ti, motherHeightCm: a.motherHeightCm, fatherHeightCm: a.fatherHeightCm }));
    });
  } else {
    teamOrder.forEach((team, ti) => {
      athletes
        .filter((a) => a.teamName === team)
        .forEach((a) => rowEntries.push({ name: a.name, teamIndex: ti, motherHeightCm: a.motherHeightCm, fatherHeightCm: a.fatherHeightCm }));
    });
  }

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(isEn ? "Measurements" : "Mediciones");

  // Header row
  const headers = isEn
    ? ["Name", "Data Collection Date (YYYY-MM-DD)", "Stature (cm)", "Body Mass (kg)", "Sitting Height (cm)", "Mother Height (cm)", "Father Height (cm)"]
    : ["Nombre", "Fecha de Medicion (AAAA-MM-DD)", "Estatura (cm)", "Masa Corporal (kg)", "Altura Sentado (cm)", "Altura Madre (cm)", "Altura Padre (cm)"];

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  // Set column widths
  ws.columns = headers.map((h) => ({ header: h, width: Math.max(h.length + 4, 20) }));
  // Remove auto-added header row from columns definition (already added manually)
  ws.spliceRows(1, 1); // remove the duplicate from columns
  ws.insertRow(1, headers);
  const hRow = ws.getRow(1);
  hRow.font = { bold: true };
  hRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };

  // Data rows with team colour; pre-fill parent heights if available
  if (rowEntries.length === 0) {
    ws.addRow([isEn ? "(no athletes)" : "(sin jugadores)", "", "", "", "", "", ""]);
  } else {
    rowEntries.forEach(({ name, teamIndex, motherHeightCm, fatherHeightCm }) => {
      const color = TEAM_COLORS[teamIndex % TEAM_COLORS.length];
      const row = ws.addRow([
        name,
        "",
        "",
        "",
        "",
        motherHeightCm ?? "",
        fatherHeightCm ?? "",
      ]);
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF" + color },
        };
      });
    });
  }

  // Legend sheet
  const teamsToLegend = showAllTeams
    ? Array.from(new Set(athletes.map((a) => a.teamName ?? ""))).sort()
    : selectedTeams;

  if (teamsToLegend.length > 0) {
    const legendWs = wb.addWorksheet(isEn ? "Legend" : "Leyenda");
    legendWs.addRow([isEn ? "Team" : "Equipo", isEn ? "Color" : "Color"]).font = { bold: true };
    teamsToLegend.forEach((team, ti) => {
      const color = TEAM_COLORS[ti % TEAM_COLORS.length];
      const row = legendWs.addRow([team, "#" + color]);
      row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } };
      row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + color } };
    });
    legendWs.columns = [{ width: 24 }, { width: 12 }];
  }

  const buffer = await wb.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${isEn ? "add-measurements" : "anadir-mediciones"}.xlsx"`,
    },
  });
}