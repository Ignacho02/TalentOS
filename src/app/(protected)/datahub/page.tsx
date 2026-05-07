"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import type { AnthropometricRecordInput } from "@/lib/types";
import { AnthropometricRecordSchema } from "@/lib/validations";
import {
  buildFallbackMeasurementTemplateRows,
  buildMeasurementsTemplateAthletes,
  downloadSheet,
  parseMeasurementImportRows,
} from "@/lib/datahub/excel";
import { resolveDataHubRouteState } from "@/lib/datahub/navigation";
import {
  filterAssessmentsForDataHub,
  getLatestAssessmentsByAthlete,
  getUniqueAthletePositions,
  getUniqueAthleteTeams,
} from "@/lib/maturation/selectors";
import { DataHubSidebar } from "./datahub-sidebar";
import { DataHubLanding } from "./datahub-landing";
import { ClubSection } from "./club-section";
import { MaturationSection } from "./maturation-section";
import { PerformanceSection } from "./performance-section";
import { emptyMaturationForm } from "./performance-constants";

export default function DataHubPage() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const { state, assessments, addRecord, updateRecord, importRecords } = useAppState();

  const initialRouteState = resolveDataHubRouteState(
    searchParams.get("tab"),
    searchParams.get("area"),
  );

  const [section, setSection] = useState(initialRouteState.section);
  const [performanceArea, setPerformanceArea] = useState(initialRouteState.performanceArea);
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
  const [showAddMeasurementModal, setShowAddMeasurementModal] = useState(false);
  const [showEditPlayerModal, setShowEditPlayerModal] = useState(false);
  const [maturationForm, setMaturationForm] = useState<AnthropometricRecordInput>({
    ...emptyMaturationForm,
    clubName: state.club.name,
  });

  const query = useDeferredValue(search);
  const latestRows = useMemo(
    () => getLatestAssessmentsByAthlete(assessments),
    [assessments],
  );
  const teams = useMemo(() => getUniqueAthleteTeams(state.athletes), [state.athletes]);
  const positions = useMemo(
    () => getUniqueAthletePositions(state.athletes),
    [state.athletes],
  );
  const filteredRows = useMemo(
    () =>
      filterAssessmentsForDataHub({
        assessments: latestRows,
        athletes: state.athletes,
        query,
        teamFilter,
        positionFilter,
        ageMin,
        ageMax,
        heightMin,
        heightMax,
      }),
    [
      latestRows,
      state.athletes,
      query,
      teamFilter,
      positionFilter,
      ageMin,
      ageMax,
      heightMin,
      heightMax,
    ],
  );

  useEffect(() => {
    const routeState = resolveDataHubRouteState(
      searchParams.get("tab"),
      searchParams.get("area"),
    );
    setSection(routeState.section);
    setPerformanceArea(routeState.performanceArea);
  }, [searchParams]);

  function setMaturationValue<K extends keyof AnthropometricRecordInput>(
    key: K,
    value: AnthropometricRecordInput[K],
  ) {
    setMaturationForm((current) => ({ ...current, [key]: value }));
  }

  function resetMaturationForm() {
    setMaturationForm({ ...emptyMaturationForm, clubName: state.club.name });
    setEditingAthleteId(null);
  }

  function saveMaturation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = AnthropometricRecordSchema.safeParse(maturationForm);
    if (!validation.success) {
      setFeedback(`error:${validation.error.issues?.[0]?.message ?? "validation error"}`);
      return;
    }

    const added = addRecord(maturationForm);
    setFeedback(added ? "saved" : "duplicate");
    if (added) {
      resetMaturationForm();
      setShowAddMeasurementModal(false);
    }
  }

  function saveEditPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = AnthropometricRecordSchema.safeParse(maturationForm);
    if (!validation.success) {
      setFeedback(`error:${validation.error.issues?.[0]?.message ?? "validation error"}`);
      return;
    }

    addRecord(maturationForm);
    setFeedback("saved");
    setShowEditPlayerModal(false);
    resetMaturationForm();
  }

  function openEditForAthlete(athleteId: string) {
    const athlete = state.athletes.find((item) => item.id === athleteId);
    if (!athlete) return;

    setMaturationForm({
      athleteId: athlete.id,
      athleteName: athlete.name,
      sex: athlete.sex,
      ageGroup: athlete.ageGroup,
      clubName: state.club.name,
      teamName: athlete.teamName,
      position: athlete.position,
      dob: athlete.dob,
      dataCollectionDate: "",
      statureCm: 0,
      bodyMassKg: 0,
      sittingHeightCm: 0,
      motherHeightCm: null,
      fatherHeightCm: null,
    });
    setEditingAthleteId(athleteId);
    setFeedback("");
    setShowEditPlayerModal(true);
  }

  function downloadMeasurementsTemplate(selectedTeams: string[] = []) {
    const isEn = t("datahub.title") === "DataHub";
    const payload = {
      athletes: buildMeasurementsTemplateAthletes(state.athletes, assessments),
      selectedTeams,
      isEn,
    };

    void (async () => {
      try {
        const response = await fetch("/api/measurements/template", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("API error");

        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = isEn ? "add-measurements.xlsx" : "anadir-mediciones.xlsx";
        anchor.click();
        URL.revokeObjectURL(url);
      } catch {
        downloadSheet(
          isEn ? "add-measurements.xlsx" : "anadir-mediciones.xlsx",
          buildFallbackMeasurementTemplateRows(state.athletes, isEn),
          isEn ? "Measurements" : "Mediciones",
        );
      }
    })();
  }

  async function importMeasurementsFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      workbook.Sheets[workbook.SheetNames[0]],
    );
    const imported = importRecords(parseMeasurementImportRows(rows, state.athletes));
    setFeedback(imported ? `imported:${imported}` : "duplicate");
    event.target.value = "";
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full min-w-0">
      {section !== "landing" && (
        <DataHubSidebar
          activeSection={section as "club" | "maturation" | "performance"}
          onSelect={setSection}
        />
      )}
      <main className="min-w-0 flex-1 p-6">
        {section === "landing" && <DataHubLanding />}
        {section === "club" && <ClubSection />}
        {section === "maturation" && (
          <MaturationSection
            state={state}
            filteredRows={filteredRows}
            assessments={assessments}
            expandedAthleteId={expandedAthleteId}
            setExpandedAthleteId={setExpandedAthleteId}
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
            emptyForm={emptyMaturationForm}
          />
        )}
        {section === "performance" && (
          <PerformanceSection
            area={performanceArea}
            setArea={setPerformanceArea}
            performanceEntries={state.performanceEntries}
          />
        )}
      </main>
    </div>
  );
}
