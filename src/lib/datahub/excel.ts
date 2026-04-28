import * as XLSX from "xlsx";
import type { AnthropometricRecordInput, Athlete, MaturationResult } from "@/lib/types";
import { AnthropometricRecordSchema } from "@/lib/validations";

const BILINGUAL_COLUMN_MAP: Record<string, string> = {
  Nombre: "Name",
  Sexo: "Sex",
  masculino: "male",
  femenino: "female",
  "Grupo de Edad": "Age Group",
  Equipo: "Team",
  Posicion: "Position",
  "Fecha de Medicion (AAAA-MM-DD)": "Data Collection Date",
  "Fecha de Medicion": "Data Collection Date",
  "Data Collection Date (YYYY-MM-DD)": "Data Collection Date",
  "Data Collection Date": "Data Collection Date",
  "Fecha de Nacimiento (AAAA-MM-DD)": "DOB",
  "Fecha de Nacimiento": "DOB",
  "Estatura (cm)": "Stature (cm)",
  "Masa Corporal (kg)": "Body Mass (kg)",
  "Altura Sentado (cm)": "Sitting Height (cm)",
  "Altura Madre (cm)": "Mother Height (cm)",
  "Altura Padre (cm)": "Father Height (cm)",
};

export function parseNullableNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function downloadSheet(
  filename: string,
  rows: Array<Record<string, unknown>>,
  sheet: string,
) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheet);
  XLSX.writeFile(workbook, filename);
}

export function normalizeAnthropometricExcelRow(row: Record<string, unknown>) {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    result[BILINGUAL_COLUMN_MAP[key] ?? key] = value;
  }
  return result;
}

export function buildFallbackMeasurementTemplateRows(
  athletes: Athlete[],
  isEn: boolean,
) {
  return athletes.map((athlete) =>
    isEn
      ? {
          Name: athlete.name,
          "Data Collection Date (YYYY-MM-DD)": "",
          "Stature (cm)": "",
          "Body Mass (kg)": "",
          "Sitting Height (cm)": "",
          "Mother Height (cm)": "",
          "Father Height (cm)": "",
        }
      : {
          Nombre: athlete.name,
          "Fecha de Medicion (AAAA-MM-DD)": "",
          "Estatura (cm)": "",
          "Masa Corporal (kg)": "",
          "Altura Sentado (cm)": "",
          "Altura Madre (cm)": "",
          "Altura Padre (cm)": "",
        },
  );
}

export function parseMeasurementImportRows(
  rows: Record<string, unknown>[],
  athletes: Athlete[],
) {
  return rows
    .map<AnthropometricRecordInput | null>((raw) => {
      const row = normalizeAnthropometricExcelRow(raw);
      const athleteName = String(row.Name ?? "").trim();
      const dataCollectionDate = String(row["Data Collection Date"] ?? "").trim();
      const statureCm = Number(row["Stature (cm)"] ?? 0);
      const bodyMassKg = Number(row["Body Mass (kg)"] ?? 0);
      const sittingHeightCm = Number(row["Sitting Height (cm)"] ?? 0);

      if (!athleteName || !dataCollectionDate || !statureCm || !bodyMassKg || !sittingHeightCm) {
        return null;
      }

      const existingAthlete = athletes.find(
        (athlete) => athlete.name.toLowerCase() === athleteName.toLowerCase(),
      );
      if (!existingAthlete) return null;

      return {
        athleteName,
        sex: existingAthlete.sex,
        ageGroup: existingAthlete.ageGroup,
        clubName: existingAthlete.clubName,
        teamName: existingAthlete.teamName,
        position: existingAthlete.position,
        dataCollectionDate,
        dob: existingAthlete.dob,
        statureCm,
        bodyMassKg,
        sittingHeightCm,
        motherHeightCm: parseNullableNumber(row["Mother Height (cm)"]) ?? null,
        fatherHeightCm: parseNullableNumber(row["Father Height (cm)"]) ?? null,
      };
    })
    .filter((row): row is AnthropometricRecordInput => Boolean(row))
    .filter((row) => AnthropometricRecordSchema.safeParse(row).success);
}

export function buildMeasurementsTemplateAthletes(
  athletes: Athlete[],
  assessments: MaturationResult[],
) {
  const latestParents = new Map<
    string,
    { motherHeightCm?: number | null; fatherHeightCm?: number | null; date: string }
  >();

  for (const assessment of assessments) {
    const existing = latestParents.get(assessment.inputs.athleteName);
    if (!existing || assessment.inputs.dataCollectionDate > existing.date) {
      latestParents.set(assessment.inputs.athleteName, {
        motherHeightCm: assessment.inputs.motherHeightCm,
        fatherHeightCm: assessment.inputs.fatherHeightCm,
        date: assessment.inputs.dataCollectionDate,
      });
    }
  }

  return athletes.map((athlete) => ({
    name: athlete.name,
    teamName: athlete.teamName,
    motherHeightCm: latestParents.get(athlete.name)?.motherHeightCm ?? null,
    fatherHeightCm: latestParents.get(athlete.name)?.fatherHeightCm ?? null,
  }));
}
