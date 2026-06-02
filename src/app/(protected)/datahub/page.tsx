"use client";

import { useDeferredValue, useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import type { AnthropometricRecordInput, PerformanceArea } from "@/lib/types";
import {
  validateAnthropometric,
  validateMaturationPlayerProfile,
  clearFieldError,
  type FieldErrors,
} from "@/lib/form-errors";
import {
  buildFallbackMeasurementTemplateRows,
  buildMeasurementsTemplateAthletes,
  downloadSheet,
  parseMeasurementImportWithStats,
} from "@/lib/datahub/excel";
import { resolveDataHubRouteState, type DataHubSportsSubSection } from "@/lib/datahub/navigation";
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const { state, assessments, addRecord, updateRecord, importRecords } = useAppState();

  const initialRouteState = resolveDataHubRouteState(
    searchParams.get("tab"),
    searchParams.get("area"),
    searchParams.get("player"),
    searchParams.get("playerArea"),
  );

  const [section, setSection] = useState(initialRouteState.section);
  const [sportsSubSection, setSportsSubSection] = useState<DataHubSportsSubSection>(initialRouteState.sportsSubSection);
  const [performanceArea, setPerformanceArea] = useState(initialRouteState.performanceArea);
  const [expandedAthleteId, setExpandedAthleteId] = useState<string | null>(initialRouteState.expandedAthleteId);
  const [initialPanel] = useState(initialRouteState.selectedPanel);
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState("all");
  const [positionFilter, setPositionFilter] = useState("all");
  const [feedback, setFeedback] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formSummary, setFormSummary] = useState("");
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
        ageMin: 0,
        ageMax: 0,
        heightMin: 0,
        heightMax: 0,
      }),
    [
      latestRows,
      state.athletes,
      query,
      teamFilter,
      positionFilter,
    ],
  );

  // ── URL sync helper ────────────────────────────────────────────────────────
  // Updates the URL without adding a new history entry, preserving all params.
  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    router.replace(`/datahub?${next.toString()}`, { scroll: false });
  }, [router, searchParams]);

  useEffect(() => {
    const routeState = resolveDataHubRouteState(
      searchParams.get("tab"),
      searchParams.get("area"),
      searchParams.get("player"),
      searchParams.get("playerArea"),
    );
    setSection(routeState.section);
    setSportsSubSection(routeState.sportsSubSection);
    setPerformanceArea(routeState.performanceArea);
    // Only restore expandedAthleteId from URL when in maturation sub-section
    if (routeState.section === "sports" && routeState.sportsSubSection === "maturation") {
      setExpandedAthleteId(routeState.expandedAthleteId);
    }
  }, [searchParams]);

  // Reset transient workspace selection when navigating away from the DataHub module completely
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("datahub_club_active_tab_v2");
        sessionStorage.removeItem("datahub_club_sub_tab");
        sessionStorage.removeItem("datahub_club_test_battery_area");
        sessionStorage.removeItem("datahub_club_selected_team_id");
        sessionStorage.removeItem("datahub_club_selected_athlete_id");
        sessionStorage.removeItem("datahub_club_selected_def");
        sessionStorage.removeItem("datahub_perf_tab_v2");
        sessionStorage.removeItem("datahub_training_load_sub_tab");
      }
    };
  }, []);

  // Clear sub-area selections only when transitioning between top-level sections inside DataHub.
  // This does not clear on initial load/refresh because prevSection starts as null.
  const prevSectionRef = useRef<string | null>(null);
  useEffect(() => {
    const currentSection = section;
    const prevSection = prevSectionRef.current;
    
    if (prevSection !== null && prevSection !== currentSection) {
      if (typeof window !== "undefined") {
        // Clear club state
        sessionStorage.removeItem("datahub_club_active_tab_v2");
        sessionStorage.removeItem("datahub_club_sub_tab");
        sessionStorage.removeItem("datahub_club_selected_team_id");
        sessionStorage.removeItem("datahub_club_selected_athlete_id");
        sessionStorage.removeItem("datahub_club_selected_def");
        // Clear sports/performance state
        sessionStorage.removeItem("datahub_club_test_battery_area");
        sessionStorage.removeItem("datahub_perf_tab_v2");
        sessionStorage.removeItem("datahub_training_load_sub_tab");
      }
      // Clear expanded athlete when leaving sports entirely
      setExpandedAthleteId(null);
    }
    prevSectionRef.current = currentSection;
  }, [section]);

  // Clear sports sub-area state when switching between maturation ↔ performance.
  // This does not clear on initial load/refresh because prevSportsSubSection starts as null.
  const prevSportsSubSectionRef = useRef<string | null>(null);
  useEffect(() => {
    const current = sportsSubSection;
    const prev = prevSportsSubSectionRef.current;

    if (prev !== null && prev !== current) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("datahub_club_test_battery_area");
        sessionStorage.removeItem("datahub_perf_tab_v2");
        sessionStorage.removeItem("datahub_training_load_sub_tab");
      }
      setExpandedAthleteId(null);
    }
    prevSportsSubSectionRef.current = current;
  }, [sportsSubSection]);

  // ── Wrapped setters that also update the URL ───────────────────────────────
  function handleSetExpandedAthleteId(id: string | null) {
    setExpandedAthleteId(id);
    updateUrl({ player: id });
  }

  function handleSetPerformanceArea(area: PerformanceArea) {
    setPerformanceArea(area);
    updateUrl({ area });
  }

  function handlePanelChange(panel: { areaKey: PerformanceArea; athleteId: string } | null) {
    if (panel) {
      updateUrl({ player: panel.athleteId, playerArea: panel.areaKey });
    } else {
      updateUrl({ player: null, playerArea: null });
    }
  }

  function handleSetSection(section: "club" | "sports" | "landing") {
    setSection(section);
    if (section === "club") {
      const currentView = searchParams.get("view");
      const view = (currentView === "plantilla" || currentView === "admin") ? currentView : "plantilla";
      router.push(`/datahub?tab=club&view=${view}`);
    } else if (section === "sports") {
      const targetTab = sportsSubSection === "performance" ? "performance" : "maturation";
      router.push(`/datahub?tab=${targetTab}`);
    } else {
      router.push("/datahub");
    }
  }

  function handleSetSportsSubSection(subSection: DataHubSportsSubSection) {
    setSportsSubSection(subSection);
    const tab = subSection === "performance" ? "performance" : "maturation";
    router.push(`/datahub?tab=${tab}`);
  }

  function setMaturationValue<K extends keyof AnthropometricRecordInput>(
    key: K,
    value: AnthropometricRecordInput[K],
  ) {
    setMaturationForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => clearFieldError(current, String(key)));
  }

  function resetMaturationForm() {
    setMaturationForm({ ...emptyMaturationForm, clubName: state.club.name });
    setEditingAthleteId(null);
    setFieldErrors({});
    setFormSummary("");
  }

  function saveMaturation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateAnthropometric(t, maturationForm, { requireAthlete: true });
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      setFormSummary(result.summary);
      setFeedback("");
      return;
    }

    setFieldErrors({});
    setFormSummary("");
    const added = addRecord(maturationForm);
    setFeedback(added ? "saved" : "duplicate");
    if (added) {
      resetMaturationForm();
      setShowAddMeasurementModal(false);
    }
  }

  function saveEditPlayer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = validateMaturationPlayerProfile(t, maturationForm);
    if (!result.success) {
      setFieldErrors(result.fieldErrors);
      setFormSummary(result.summary);
      setFeedback("");
      return;
    }

    setFieldErrors({});
    setFormSummary("");
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
    setFieldErrors({});
    setFormSummary("");
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
    const { records, skipped } = parseMeasurementImportWithStats(rows, state.athletes);
    const imported = importRecords(records);
    if (imported > 0) {
      setFeedback(
        skipped > 0
          ? `import-partial:${imported}:${skipped}`
          : `imported:${imported}`,
      );
    } else if (skipped > 0) {
      setFeedback(`import-none:${skipped}`);
    } else {
      setFeedback("duplicate");
    }
    event.target.value = "";
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full min-w-0">
      {section !== "landing" && (
        <DataHubSidebar
          activeSection={section as "club" | "sports" | "landing"}
          onSelect={handleSetSection}
        />
      )}
      <main className="min-w-0 flex-1 bg-[#f8fafc] p-4 sm:p-6 md:p-8 overflow-x-hidden">
        <div className="mx-auto max-w-7xl space-y-8">
        {section === "landing" && <DataHubLanding onSelect={(s) => handleSetSection(s)} />}
        {section !== "landing" && (() => {
          let titleKey = "datahub.landingTitle";
          let subtitleKey = "datahub.landingSubtitle";
          if (section === "club") {
            titleKey = "datahub.sectionTitleClub";
            subtitleKey = "datahub.sectionSubtitleClub";
          } else if (section === "sports") {
            if (sportsSubSection === "maturation") {
              titleKey = "datahub.sectionTitleMaturation";
              subtitleKey = "datahub.sectionSubtitleMaturation";
            } else if (sportsSubSection === "performance") {
              titleKey = "datahub.sectionTitlePerformance";
              subtitleKey = "datahub.sectionSubtitlePerformance";
            } else {
              titleKey = "datahub.sectionTitleSports";
              subtitleKey = "datahub.sectionSubtitleSports";
            }
          }
          return (
            <header>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t(titleKey)}</h1>
              <p className="mt-1 text-slate-500">{t(subtitleKey)}</p>
            </header>
          );
        })()}
        {section === "club" && (
          <ClubSection
            canEditAthletes={state.currentUserRole === "admin" || state.currentUserPermissions.canEditAthletes}
          />
        )}
        {section === "sports" && (
          <div className="space-y-6">
            <div className="flex gap-2 flex-wrap">
              {[
                { id: "maturation" as const, label: t("datahubNav.maturation") },
                { id: "performance" as const, label: t("datahubNav.performance") },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSetSportsSubSection(item.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition",
                    sportsSubSection === item.id
                      ? "bg-accent text-white"
                      : "bg-white border border-line text-zinc-600 hover:bg-zinc-50",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {sportsSubSection === "maturation" && (
              <MaturationSection
                state={state}
                filteredRows={filteredRows}
                assessments={assessments}
                expandedAthleteId={expandedAthleteId}
                setExpandedAthleteId={handleSetExpandedAthleteId}
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
                fieldErrors={fieldErrors}
                formSummary={formSummary}
                showAddMeasurementModal={showAddMeasurementModal}
                setShowAddMeasurementModal={setShowAddMeasurementModal}
                showEditPlayerModal={showEditPlayerModal}
                setShowEditPlayerModal={setShowEditPlayerModal}
                editingAthleteId={editingAthleteId}
                setEditingAthleteId={setEditingAthleteId}
                openEditForAthlete={openEditForAthlete}
                emptyForm={emptyMaturationForm}
                canEditAnthropometry={state.currentUserRole === "admin" || state.currentUserPermissions.canEditAnthropometry}
              />
            )}

            {sportsSubSection === "performance" && (
              <PerformanceSection
                area={performanceArea}
                setArea={handleSetPerformanceArea}
                performanceEntries={state.performanceEntries}
                initialPanel={initialPanel}
                onPanelChange={handlePanelChange}
                canEditPerformance={state.currentUserRole === "admin" || state.currentUserPermissions.canEditPerformance}
              />
            )}
          </div>
        )}
        </div>
      </main>
    </div>
  );
}