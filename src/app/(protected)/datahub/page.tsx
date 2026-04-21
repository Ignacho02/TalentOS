"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import type { AnthropometricRecordInput, PerformanceArea } from "@/lib/types";
import { AnthropometricRecordSchema } from "@/lib/validations";
import { DataHubSidebar } from "./datahub-sidebar";
import { DataHubLanding } from "./datahub-landing";
import { ClubSection } from "./club-section";
import { MaturationSection } from "./maturation-section";
import { PerformanceSection } from "./performance-section";
import { emptyMaturationForm, emptyPerformanceForm, performancePresets } from "./performance-constants";

type DataHubSection = "landing" | "club" | "maturation" | "performance";

function parseNumber(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function downloadSheet(filename: string, rows: Array<Record<string, unknown>>, sheet: string) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), sheet);
  XLSX.writeFile(workbook, filename);
}

export default function DataHubPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const { state, assessments, addRecord, updateRecord, importRecords, importPerformanceEntries } = useAppState();
  
  // Initialize section and performanceArea from URL params (lazy initialization)
  const initialState = useMemo(() => {
    const tab = searchParams.get("tab");
    const area = searchParams.get("area");
    if (tab === "anthropometric" || tab === "maturation") return { section: "maturation" as const, performanceArea: "physical" as const };
    if (tab === "physical" || tab === "technicalTactical" || tab === "psychological") {
      return { section: "performance" as const, performanceArea: tab as PerformanceArea };
    }
    if (tab === "performance" && area === "motorSkills") {
      return { section: "performance" as const, performanceArea: "motorSkills" as const };
    }
    if (tab === "performance") {
      return { section: "performance" as const, performanceArea: "physical" as const };
    }
    if (tab === "club") return { section: "club" as const, performanceArea: "physical" as const };
    return { section: "landing" as const, performanceArea: "physical" as const };
  }, []);
  
  const [section, setSection] = useState<DataHubSection>(initialState.section);
  const [performanceArea, setPerformanceArea] = useState<PerformanceArea>(initialState.performanceArea);

  // Sync URL params with section state
  useEffect(() => {
    const tab = searchParams.get("tab");
    const area = searchParams.get("area");
    if (tab === "anthropometric" || tab === "maturation") {
      setSection("maturation");
      setPerformanceArea("physical");
    } else if (tab === "physical" || tab === "technicalTactical" || tab === "psychological") {
      setSection("performance");
      setPerformanceArea(tab);
    } else if (tab === "performance" && area === "motorSkills") {
      setSection("performance");
      setPerformanceArea("motorSkills");
    } else if (tab === "performance") {
      setSection("performance");
      setPerformanceArea("physical");
    } else if (tab === "club") {
      setSection("club");
      setPerformanceArea("physical");
    } else if (!tab) {
      setSection("landing");
    }
  }, [searchParams]);

  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [ageMin, setAgeMin] = useState(10);
  const [ageMax, setAgeMax] = useState(20);
  const [heightMin, setHeightMin] = useState(120);
  const [heightMax, setHeightMax] = useState(220);
  const [feedback, setFeedback] = useState("");
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const [showAddPlayerModal, setShowAddPlayerModal] = useState(false);
  const [showAddMeasurementModal, setShowAddMeasurementModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [maturationForm, setMaturationForm] = useState<AnthropometricRecordInput>({ ...emptyMaturationForm, clubName: state.club.name });
  const query = useDeferredValue(search);

  const latestRows = useMemo(() => {
    const latest = new Map<string, (typeof assessments)[number]>();
    for (const assessment of assessments) {
      const current = latest.get(assessment.inputs.athleteId);
      if (!current || current.inputs.dataCollectionDate < assessment.inputs.dataCollectionDate) latest.set(assessment.inputs.athleteId, assessment);
    }
    return Array.from(latest.values()).sort((a, b) => a.inputs.athleteName.localeCompare(b.inputs.athleteName));
  }, [assessments]);

  const teams = Array.from(new Set(state.athletes.map((a) => a.teamName).filter(Boolean))) as string[];
  const positions = Array.from(new Set(state.athletes.map((a) => a.position).filter(Boolean))) as string[];

  const filteredRows = useMemo(() => {
    return latestRows.filter((row) => {
      const athlete = state.athletes.find((c) => c.id === row.inputs.athleteId);
      const haystack = [row.inputs.athleteName, athlete?.teamName ?? row.inputs.teamName ?? "", athlete?.position ?? row.inputs.position ?? ""].join(" ").toLowerCase();
      if (query && !haystack.includes(query.toLowerCase())) return false;
      if (teamFilter !== "all" && row.inputs.teamName !== teamFilter) return false;
      if (positionFilter !== "all" && (athlete?.position ?? row.inputs.position) !== positionFilter) return false;
      if (ageMin && row.derivedMetrics.chronologicalAge < ageMin) return false;
      if (ageMax && row.derivedMetrics.chronologicalAge > ageMax) return false;
      if (heightMin && row.inputs.statureCm < heightMin) return false;
      if (heightMax && row.inputs.statureCm > heightMax) return false;
      return true;
    });
  }, [latestRows, state.athletes, query, teamFilter, positionFilter, ageMin, ageMax, heightMin, heightMax]);

  function setMaturationValue<K extends keyof AnthropometricRecordInput>(key: K, value: AnthropometricRecordInput[K]) {
    setMaturationForm((current) => ({ ...current, [key]: value }));
  }

  function saveMaturation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = AnthropometricRecordSchema.safeParse(maturationForm);
    if (!validation.success) { setFeedback(`error:${validation.error.issues?.[0]?.message ?? "validation error"}`); return; }
    const added = addRecord(maturationForm);
    setFeedback(added ? "saved" : "duplicate");
    if (added) { setMaturationForm({ ...emptyMaturationForm, clubName: state.club.name }); setEditingAthleteId(null); setShowAddPlayerModal(false); setShowAddMeasurementModal(false); }
  }

  function saveEditPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = AnthropometricRecordSchema.safeParse(maturationForm);
    if (!validation.success) { setFeedback(`error:${validation.error.issues?.[0]?.message ?? "validation error"}`); return; }
    addRecord(maturationForm);
    setFeedback("saved");
    setShowEditPlayerModal(false);
    setEditingAthleteId(null);
  }

  function openEditForAthlete(athleteId: string) {
    const athlete = state.athletes.find((a) => a.id === athleteId);
    if (!athlete) return;
    setMaturationForm({ athleteName: athlete.name, sex: athlete.sex, ageGroup: athlete.ageGroup, clubName: state.club.name, teamName: athlete.teamName, position: athlete.position, dob: athlete.dob, dataCollectionDate: "", statureCm: 0, bodyMassKg: 0, sittingHeightCm: 0, motherHeightCm: null, fatherHeightCm: null });
    setEditingAthleteId(athleteId);
    setFeedback("");
    setShowEditPlayerModal(true);
  }

  function openAddMeasurementForAthlete(athleteId: string) {
    const athlete = state.athletes.find((a) => a.id === athleteId);
    if (!athlete) return;
    setMaturationForm({ athleteName: athlete.name, sex: athlete.sex, ageGroup: athlete.ageGroup, clubName: state.club.name, teamName: athlete.teamName, position: athlete.position, dob: athlete.dob, dataCollectionDate: "", statureCm: 0, bodyMassKg: 0, sittingHeightCm: 0, motherHeightCm: null, fatherHeightCm: null });
    setEditingAthleteId(athleteId);
    setFeedback("");
    setShowAddMeasurementModal(true);
  }

  function downloadPlayersTemplate() {
    const isEn = t("datahub.title") === "DataHub";
    downloadSheet(isEn ? "add-players.xlsx" : "anadir-jugadores.xlsx", [isEn ? { Name: "Sample Athlete", Sex: "male", "Age Group": "U14", Team: "U14 Boys", Position: "Winger", Club: state.club.name, "Data Collection Date (YYYY-MM-DD)": "2026-03-18", DOB: "2012-02-14", "Stature (cm)": 157.4, "Body Mass (kg)": 46.3, "Sitting Height (cm)": 81.5, "Mother Height (cm)": 165, "Father Height (cm)": 178 } : { Nombre: "Ej: Juan Perez", Sexo: "masculino", "Grupo de Edad": "Sub-14", Equipo: "Juvenil A", Posicion: "Delantero", Club: state.club.name, "Fecha de Medicion (AAAA-MM-DD)": "2026-03-18", "Fecha de Nacimiento (AAAA-MM-DD)": "2012-02-14", "Estatura (cm)": 157.4, "Masa Corporal (kg)": 46.3, "Altura Sentado (cm)": 81.5, "Altura Madre (cm)": 165, "Altura Padre (cm)": 178 }], isEn ? "Players" : "Jugadores");
  }

  async function downloadMeasurementsTemplate(selectedTeams: string[] = []) {
    const isEn = t("datahub.title") === "DataHub";
    try {
      const res = await fetch("/api/measurements/template", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          athletes: (() => {
            // Build latest parent heights per athlete from assessments
            const latestParents = new Map<string, { motherHeightCm?: number | null; fatherHeightCm?: number | null }>();
            for (const rec of assessments) {
              const existing = latestParents.get(rec.inputs.athleteName);
              if (!existing || rec.inputs.dataCollectionDate > (existing as { _date?: string })._date!) {
                latestParents.set(rec.inputs.athleteName, {
                  motherHeightCm: rec.inputs.motherHeightCm,
                  fatherHeightCm: rec.inputs.fatherHeightCm,
                  _date: rec.inputs.dataCollectionDate,
                } as { motherHeightCm?: number | null; fatherHeightCm?: number | null; _date?: string });
              }
            }
            return state.athletes.map((a) => ({
              name: a.name,
              teamName: a.teamName,
              motherHeightCm: latestParents.get(a.name)?.motherHeightCm ?? null,
              fatherHeightCm: latestParents.get(a.name)?.fatherHeightCm ?? null,
            }));
          })(),
          selectedTeams,
          isEn,
        }),
      });
      if (!res.ok) throw new Error("API error");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = isEn ? "add-measurements.xlsx" : "anadir-mediciones.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: plain xlsx without colours
      const rows = state.athletes.map((a) =>
        isEn
          ? { Name: a.name, "Data Collection Date (YYYY-MM-DD)": "", "Stature (cm)": "", "Body Mass (kg)": "", "Sitting Height (cm)": "", "Mother Height (cm)": "", "Father Height (cm)": "" }
          : { Nombre: a.name, "Fecha de Medicion (AAAA-MM-DD)": "", "Estatura (cm)": "", "Masa Corporal (kg)": "", "Altura Sentado (cm)": "", "Altura Madre (cm)": "", "Altura Padre (cm)": "" }
      );
      downloadSheet(isEn ? "add-measurements.xlsx" : "anadir-mediciones.xlsx", rows, isEn ? "Measurements" : "Mediciones");
    }
  }

  function normalizeExcelRow(row: Record<string, unknown>) {
    const map: Record<string, string> = { "Nombre": "Name", "Sexo": "Sex", "masculino": "male", "femenino": "female", "Grupo de Edad": "Age Group", "Equipo": "Team", "Posicion": "Position", "Fecha de Medicion (AAAA-MM-DD)": "Data Collection Date", "Fecha de Medicion": "Data Collection Date", "Data Collection Date (YYYY-MM-DD)": "Data Collection Date", "Data Collection Date": "Data Collection Date", "Fecha de Nacimiento (AAAA-MM-DD)": "DOB", "Fecha de Nacimiento": "DOB", "Estatura (cm)": "Stature (cm)", "Masa Corporal (kg)": "Body Mass (kg)", "Altura Sentado (cm)": "Sitting Height (cm)", "Altura Madre (cm)": "Mother Height (cm)", "Altura Padre (cm)": "Father Height (cm)" };
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) result[map[key] ?? key] = value;
    return result;
  }

  async function importPlayersFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
    const normalized = rows.map<AnthropometricRecordInput | null>((raw) => {
      const row = normalizeExcelRow(raw);
      const athleteName = String(row["Name"] ?? "").trim();
      const sexValue = String(row["Sex"] ?? "").trim().toLowerCase();
      const dataCollectionDate = String(row["Data Collection Date"] ?? "").trim();
      const dob = String(row["DOB"] ?? "").trim();
      const statureCm = Number(row["Stature (cm)"] ?? 0);
      const bodyMassKg = Number(row["Body Mass (kg)"] ?? 0);
      const sittingHeightCm = Number(row["Sitting Height (cm)"] ?? 0);
      if (!athleteName || !sexValue || !dataCollectionDate || !dob || !statureCm || !bodyMassKg || !sittingHeightCm) return null;
      return { athleteName, sex: sexValue === "female" ? "female" : "male", ageGroup: String(row["Age Group"] ?? "").trim(), clubName: String(row["Club"] ?? state.club.name).trim() || state.club.name, teamName: String(row["Team"] ?? "").trim(), position: String(row["Position"] ?? "").trim(), dataCollectionDate, dob, statureCm, bodyMassKg, sittingHeightCm, motherHeightCm: parseNumber(row["Mother Height (cm)"]), fatherHeightCm: parseNumber(row["Father Height (cm)"]) };
    }).filter((row): row is AnthropometricRecordInput => Boolean(row)).filter((row) => AnthropometricRecordSchema.safeParse(row).success);
    const imported = importRecords(normalized);
    setFeedback(imported ? `imported:${imported}` : "duplicate");
    event.target.value = "";
  }

  async function importMeasurementsFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[workbook.SheetNames[0]]);
    const normalized = rows.map<AnthropometricRecordInput | null>((raw) => {
      const row = normalizeExcelRow(raw);
      const athleteName = String(row["Name"] ?? "").trim();
      const dataCollectionDate = String(row["Data Collection Date"] ?? "").trim();
      const statureCm = Number(row["Stature (cm)"] ?? 0);
      const bodyMassKg = Number(row["Body Mass (kg)"] ?? 0);
      const sittingHeightCm = Number(row["Sitting Height (cm)"] ?? 0);
      if (!athleteName || !dataCollectionDate || !statureCm || !bodyMassKg || !sittingHeightCm) return null;
      const existingAthlete = state.athletes.find((a) => a.name.toLowerCase() === athleteName.toLowerCase());
      if (!existingAthlete) return null;
      return { athleteName, sex: existingAthlete.sex, ageGroup: existingAthlete.ageGroup, clubName: existingAthlete.clubName, teamName: existingAthlete.teamName, position: existingAthlete.position, dataCollectionDate, dob: existingAthlete.dob, statureCm, bodyMassKg, sittingHeightCm, motherHeightCm: parseNumber(row["Mother Height (cm)"]) ?? null, fatherHeightCm: parseNumber(row["Father Height (cm)"]) ?? null };
    }).filter((row): row is AnthropometricRecordInput => Boolean(row)).filter((row) => AnthropometricRecordSchema.safeParse(row).success);
    const imported = importRecords(normalized);
    setFeedback(imported ? `imported:${imported}` : "duplicate");
    event.target.value = "";
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {section !== "landing" && <DataHubSidebar activeSection={section as "club" | "maturation" | "performance"} onSelect={setSection} />}
      <main className="flex-1 p-6 overflow-auto">
        {section === "landing" && <DataHubLanding />}
        {section === "club" && <ClubSection />}
        {section === "maturation" && (
          <MaturationSection
            state={state}
            filteredRows={filteredRows}
            assessments={assessments}
            expandedAthleteId={expandedAthleteId}
            setExpandedAthleteId={setExpandedAthleteId}
            search={search}
            setSearch={setSearch}
            teamFilter={teamFilter}
            setTeamFilter={setTeamFilter}
            positionFilter={positionFilter}
            setPositionFilter={setPositionFilter}
            ageMin={ageMin}
            setAgeMin={setAgeMin}
            ageMax={ageMax}
            setAgeMax={setAgeMax}
            heightMin={heightMin}
            setHeightMin={setHeightMin}
            heightMax={heightMax}
            setHeightMax={setHeightMax}
            teams={teams}
            positions={positions}
            maturationForm={maturationForm}
            setMaturationForm={setMaturationForm}
            setMaturationValue={setMaturationValue}
            saveMaturation={saveMaturation}
            saveEditPlayer={saveEditPlayer}
            downloadMeasurementsTemplate={downloadMeasurementsTemplate}
            importMeasurementsFile={importMeasurementsFile}
            updateRecord={updateRecord}
            feedback={feedback}
            showAddMeasurementModal={showAddMeasurementModal}
            setShowAddMeasurementModal={setShowAddMeasurementModal}
            showEditPlayerModal={showEditPlayerModal}
            setShowEditPlayerModal={setShowEditPlayerModal}
            editingAthleteId={editingAthleteId}
            setEditingAthleteId={setEditingAthleteId}
            openEditForAthlete={openEditForAthlete}
            openAddMeasurementForAthlete={openAddMeasurementForAthlete}
            emptyForm={emptyMaturationForm}
          />
        )}
        {section === "performance" && <PerformanceSection area={performanceArea} setArea={setPerformanceArea} performanceEntries={state.performanceEntries} />}
      </main>
    </div>
  );
}