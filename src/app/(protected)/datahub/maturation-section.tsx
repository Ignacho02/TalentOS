"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { Range } from "react-range";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Plus,
  UploadCloud,
  X,
  Info,
  Settings,
} from "lucide-react";
import { LabeledField } from "@/components/labeled-field";
import { FormErrorBanner } from "@/components/form-error-banner";
import { FieldError, invalidInputClass } from "@/components/field-error";
import { validateAnthropometric, type FieldErrors } from "@/lib/form-errors";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import type { AnthropometricRecordInput, UnifiedMaturityProfile } from "@/lib/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { MaturationPreferences } from "@/components/maturation-preferences";
import { createUnifiedProfile, MaturationEngine } from "@/lib/maturation/unified-maturation";

/** Filter range bounds — kept in one place to avoid drift between state and UI. */
const FILTER_RANGES = {
  age: { min: 0, max: 100 },
  stature: { min: 0, max: 300 },
  mass: { min: 0, max: 250 },
  sitting: { min: 0, max: 200 },
  offset: { min: -20, max: 20 },
  fransen: { min: -20, max: 20 },
  moore: { min: 0, max: 30 },
  pah: { min: 0, max: 200 },
  mirwald: { min: -20, max: 20 },
  shr: { min: 40, max: 70 },
  whoBmi: { min: -4, max: 4 },
  velocity: { min: -10, max: 30 },
};

/** Default initial values for the column filter state. */
const DEFAULT_COLUMN_FILTERS = {
  athlete: [] as string[],
  team: [] as string[],
  position: [] as string[],
  band: [] as string[],
  age: { min: FILTER_RANGES.age.min, max: FILTER_RANGES.age.max },
  stature: { min: FILTER_RANGES.stature.min, max: FILTER_RANGES.stature.max },
  mass: { min: FILTER_RANGES.mass.min, max: FILTER_RANGES.mass.max },
  sitting: { min: FILTER_RANGES.sitting.min, max: FILTER_RANGES.sitting.max },
  offset: { min: FILTER_RANGES.offset.min, max: FILTER_RANGES.offset.max },
  fransen: { min: FILTER_RANGES.fransen.min, max: FILTER_RANGES.fransen.max },
  moore: { min: FILTER_RANGES.moore.min, max: FILTER_RANGES.moore.max },
  pah: { min: FILTER_RANGES.pah.min, max: FILTER_RANGES.pah.max },
  mirwald: { min: FILTER_RANGES.mirwald.min, max: FILTER_RANGES.mirwald.max },
  shr: { min: FILTER_RANGES.shr.min, max: FILTER_RANGES.shr.max },
  whoBmi: { min: FILTER_RANGES.whoBmi.min, max: FILTER_RANGES.whoBmi.max },
  velocity: { min: FILTER_RANGES.velocity.min, max: FILTER_RANGES.velocity.max },
};

export function MaturationSection({
  state,
  filteredRows,
  assessments,
  expandedAthleteId,
  setExpandedAthleteId,
  teams,
  positions,
  maturationForm,
  setMaturationForm,
  setMaturationValue,
  saveMaturation,
  saveEditPlayer,
  downloadMeasurementsTemplate,
  importMeasurementsFile,
  updateRecord,
  feedback,
  fieldErrors,
  formSummary,
  showAddMeasurementModal,
  setShowAddMeasurementModal,
  showEditPlayerModal,
  setShowEditPlayerModal,
  editingAthleteId,
  setEditingAthleteId,
  openEditForAthlete,
  emptyForm,
  canEditAnthropometry,
}: {
  state: ReturnType<typeof useAppState>["state"];
  filteredRows: ReturnType<typeof useAppState>["assessments"];
  assessments: ReturnType<typeof useAppState>["assessments"];
  expandedAthleteId: string | null;
  setExpandedAthleteId: (id: string | null) => void;
  teams: string[];
  positions: string[];
  maturationForm: AnthropometricRecordInput;
  setMaturationForm: (form: AnthropometricRecordInput) => void;
  setMaturationValue: <K extends keyof AnthropometricRecordInput>(
    key: K,
    value: AnthropometricRecordInput[K],
  ) => void;
  saveMaturation: (event: React.FormEvent<HTMLFormElement>) => void;
  saveEditPlayer: (event: React.FormEvent<HTMLFormElement>) => void;
  downloadMeasurementsTemplate: (selectedTeams?: string[]) => void | Promise<void>;
  importMeasurementsFile: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  updateRecord: (id: string, updates: Partial<AnthropometricRecordInput>) => void;
  feedback: string;
  fieldErrors: FieldErrors;
  formSummary: string;
  showAddMeasurementModal: boolean;
  setShowAddMeasurementModal: (show: boolean) => void;
  showEditPlayerModal: boolean;
  setShowEditPlayerModal: (show: boolean) => void;
  editingAthleteId: string | null;
  setEditingAthleteId: (id: string | null) => void;
  openEditForAthlete: (athleteId: string) => void;
  emptyForm: AnthropometricRecordInput;
  canEditAnthropometry?: boolean;
}) {
  const { t, locale } = useLocale();

  const translateEngineLabel = (engine: MaturationEngine): string => {
    const map: Record<MaturationEngine, string> = {
      auto: t("maturationMethods.auto"),
      fransen: t("maturationMethods.fransen"),
      moore: t("maturationMethods.moore"),
      mirwald: t("maturationMethods.mirwald"),
      sherar: t("maturationMethods.sherar"),
      sitar: t("maturationMethods.sitar"),
      consensus: t("maturationMethods.consensus"),
    };
    return map[engine] ?? engine;
  };
  const [viewMode, setViewMode] = useState({
    anthropometric: true,
    maturation: true,
  });
  const [columnFilters, setColumnFilters] = useState(DEFAULT_COLUMN_FILTERS);
  const [athleteSearch, setAthleteSearch] = useState("");
  const [showColumnFilter, setShowColumnFilter] = useState<string | null>(null);
  const selectedAthleteId = expandedAthleteId;
  const setSelectedAthleteId = setExpandedAthleteId;
  const [editingRecord, setEditingRecord] = useState<(AnthropometricRecordInput & { id: string }) | null>(null);
  const [inlineEditErrors, setInlineEditErrors] = useState<FieldErrors>({});
  const [inlineEditSummary, setInlineEditSummary] = useState("");
  const measurementsFileRef = useRef<HTMLInputElement>(null);

  const toggleAthleteFilter = (name: string) => {
    setColumnFilters((prev) => ({
      ...prev,
      athlete: prev.athlete.includes(name)
        ? prev.athlete.filter((item) => item !== name)
        : [...prev.athlete, name],
    }));
  };

  const filteredData = useMemo(() => {
    return filteredRows.filter((row) => {
      const athlete = state.athletes.find(
        (candidate) =>
          candidate.id === row.inputs.athleteId ||
          (
            candidate.name.toLowerCase() === row.inputs.athleteName.toLowerCase() &&
            candidate.dob === row.inputs.dob
          ),
      );

      // Filtro de jugador por selecci\u00f3n expl\u00edcita
      if (columnFilters.athlete.length > 0 && !columnFilters.athlete.includes(row.inputs.athleteName)) {
        return false;
      }

      // Filtro de equipos (m\u00faltiple)
      if (columnFilters.team.length > 0 && (!row.inputs.teamName || !columnFilters.team.includes(row.inputs.teamName))) {
        return false;
      }

      // Filtro de posiciones (m\u00faltiple)
      if (columnFilters.position.length > 0 && (!athlete?.position || !columnFilters.position.includes(athlete.position))) {
        return false;
      }

      // Filtros de rango
      if (row.derivedMetrics.chronologicalAge < columnFilters.age.min || row.derivedMetrics.chronologicalAge > columnFilters.age.max) {
        return false;
      }
      if (row.inputs.statureCm < columnFilters.stature.min || row.inputs.statureCm > columnFilters.stature.max) {
        return false;
      }
      if (row.inputs.bodyMassKg < columnFilters.mass.min || row.inputs.bodyMassKg > columnFilters.mass.max) {
        return false;
      }
      if (row.inputs.sittingHeightCm < columnFilters.sitting.min || row.inputs.sittingHeightCm > columnFilters.sitting.max) {
        return false;
      }

      // Filtros de maduracion
      if (columnFilters.band.length > 0 && !columnFilters.band.includes(row.classification.maturityBand)) {
        return false;
      }
      if (row.classification.primaryOffset < columnFilters.offset.min || row.classification.primaryOffset > columnFilters.offset.max) {
        return false;
      }
      if (row.methodOutputs.fransenOffset !== null && (row.methodOutputs.fransenOffset < columnFilters.fransen.min || row.methodOutputs.fransenOffset > columnFilters.fransen.max)) {
        return false;
      }
      if (row.methodOutputs.mooreAphv < columnFilters.moore.min || row.methodOutputs.mooreAphv > columnFilters.moore.max) {
        return false;
      }
      const pah = row.methodOutputs.percentageAdultHeight;
      if (pah !== null && (pah < columnFilters.pah.min || pah > columnFilters.pah.max)) {
        return false;
      }
      if (row.methodOutputs.mirwaldOffset < columnFilters.mirwald.min || row.methodOutputs.mirwaldOffset > columnFilters.mirwald.max) {
        return false;
      }
      if (row.derivedMetrics.sittingHeightRatio < columnFilters.shr.min || row.derivedMetrics.sittingHeightRatio > columnFilters.shr.max) {
        return false;
      }
      if (row.classification.whoBmiZScore !== null && (row.classification.whoBmiZScore < columnFilters.whoBmi.min || row.classification.whoBmiZScore > columnFilters.whoBmi.max)) {
        return false;
      }
      const velocity = row.derivedMetrics.growthVelocityCmPerYear;
      const velocityFilterActive =
        columnFilters.velocity.min !== FILTER_RANGES.velocity.min ||
        columnFilters.velocity.max !== FILTER_RANGES.velocity.max;
      if (velocity === null) {
        if (velocityFilterActive) return false;
      } else if (velocity < columnFilters.velocity.min || velocity > columnFilters.velocity.max) {
        return false;
      }

      return true;
    });
  }, [filteredRows, state.athletes, columnFilters]);

  const toggleTeamFilter = (team: string) => {
    setColumnFilters(prev => ({
      ...prev,
      team: prev.team.includes(team)
        ? prev.team.filter(t => t !== team)
        : [...prev.team, team]
    }));
  };

  const togglePositionFilter = (position: string) => {
    setColumnFilters(prev => ({
      ...prev,
      position: prev.position.includes(position)
        ? prev.position.filter(p => p !== position)
        : [...prev.position, position]
    }));
  };

  const toggleBandFilter = (band: string) => {
    setColumnFilters(prev => ({
      ...prev,
      band: prev.band.includes(band)
        ? prev.band.filter(b => b !== band)
        : [...prev.band, band]
    }));
  };

  const maturityBands = useMemo(() => {
    const bands = new Set(filteredRows.map((r) => r.classification.maturityBand));
    return Array.from(bands).sort();
  }, [filteredRows]);

  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [groupByTeam, setGroupByTeam] = useState(true);
  const [groupByPHV, setGroupByPHV] = useState(true);
  const [sortWithinGroup, setSortWithinGroup] = useState<"name" | "age" | "offset">("name");
  const [downloadTeams, setDownloadTeams] = useState<string[]>([]);
  
  // Concept-centric: user preferences for maturation calculation
  const [selectedEngine, setSelectedEngine] = useState<MaturationEngine>("auto");
  const [bioBandingStrategy, setBioBandingStrategy] = useState<"offset" | "pah">("offset");
  const [showScientificBasis, setShowScientificBasis] = useState(false);

  const handleTeamClick = (team: string | null) => {
    setSelectedTeam(team);
    if (team) {
      // Selecting a specific team: clear the team column filter and set this team
      setColumnFilters((prev) => ({ ...prev, team: [team] }));
    } else {
      // "All" selected: clear the team column filter
      setColumnFilters((prev) => ({ ...prev, team: [] }));
    }
  };

  return (
    <div className="space-y-4">
      {/* Add measurement button — above the table panel */}
      <div className="flex justify-end gap-2">
        <button
          onClick={() => setShowScientificBasis(!showScientificBasis)}
          className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          title={t("maturationMethods.scientificBasis")}
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={() => setShowAddMeasurementModal(true)}
          disabled={!canEditAnthropometry}
          className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="h-4 w-4" />
          {t("datahub.addMeasurementTitle")}
        </button>
      </div>

      {/* Scientific Basis Panel */}
      {showScientificBasis && (() => {
        const selectedAthlete = selectedAthleteId 
          ? state.athletes.find((athlete) => athlete.id === selectedAthleteId)
          : null;
        const athleteSex = selectedAthlete?.sex === "female" ? "female" : "male";
        
        // Count measurements for this athlete
        const athleteMeasurementCount = selectedAthleteId
          ? assessments.filter((row) => row.inputs.athleteId === selectedAthleteId).length
          : 0;
        
        return (
          <MaturationPreferences
            selectedEngine={selectedEngine}
            onEngineChange={setSelectedEngine}
            bioBandingStrategy={bioBandingStrategy}
            onBioStrategyChange={setBioBandingStrategy}
            t={t}
            sex={athleteSex}
            measurementCount={athleteMeasurementCount}
          />
        );
      })()}

      {/* Tabla de datos */}
      <section className="panel rounded-[1.75rem] p-6 overflow-visible">
        <div className="mb-4">
          <h2 className="text-xl font-semibold">{t("datahub.playersListTitle")}</h2>
          <p className="mt-1 text-sm text-zinc-600">{t("datahub.clickHeaderHint")}</p>
        </div>

        {/* Toolbar: view + group + sort controls — each group is kept together */}
        <div className="mb-5 flex flex-wrap gap-2 items-center">
          {/* View group */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-zinc-600">{t("datahub.viewLabel")}:</span>
            {[
              { key: "anthropometric", label: t("datahub.viewAnthropometric") },
              { key: "maturation", label: t("datahub.viewMaturation") },
            ].map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setViewMode((prev) => ({
                  ...prev,
                  [option.key]: !prev[option.key as keyof typeof prev],
                }))}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  viewMode[option.key as keyof typeof viewMode]
                    ? "bg-accent text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="text-zinc-300 shrink-0">|</span>
          {/* Group group */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-zinc-600">{t("datahub.groupLabel")}:</span>
            <button
              type="button"
              onClick={() => setGroupByTeam((v) => !v)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                groupByTeam ? "bg-accent text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              )}
            >
              {t("datahub.groupByTeam")}
            </button>
            <button
              type="button"
              onClick={() => setGroupByPHV((v) => !v)}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm font-medium transition",
                groupByPHV ? "bg-accent text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
              )}
            >
              {t("datahub.groupByPHV") || "PHV"}
            </button>
          </div>
          <span className="text-zinc-300 shrink-0">|</span>
          {/* Sort group */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-zinc-600">{t("datahub.sortLabel")}:</span>
            <select
              value={sortWithinGroup}
              onChange={(e) => setSortWithinGroup(e.target.value as "name" | "age" | "offset")}
              className="rounded-full border border-line bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 outline-none cursor-pointer"
            >
              <option value="name">{t("datahub.sortByName")}</option>
              <option value="age">{t("datahub.sortByAge")}</option>
              <option value="offset">{t("datahub.sortByOffset")}</option>
            </select>
          </div>

          {/* Reset Filters button */}
          {JSON.stringify(columnFilters) !== JSON.stringify(DEFAULT_COLUMN_FILTERS) && (
            <button
              type="button"
              onClick={() => {
                setColumnFilters(DEFAULT_COLUMN_FILTERS);
                setAthleteSearch("");
              }}
              className="flex items-center gap-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-4 py-1.5 text-sm font-semibold transition ml-auto"
            >
              <X className="h-4 w-4" />
              {locale === 'es' ? 'Reiniciar Filtros' : 'Reset Filters'}
            </button>
          )}
        </div>

        <div className="table-scroll overflow-x-auto">
          <table className="w-full min-w-max text-center text-sm [&_thead_button]:mx-auto [&_thead_button]:justify-center">
            <thead>
              <tr>
                <th className="border-b border-line px-3 py-3"></th>
{viewMode.anthropometric && (
                  <th className="border-b border-line bg-white/70 px-3 py-3 text-xs uppercase tracking-[0.18em] text-zinc-600" colSpan={7}>
                    {t("datahub.anthropometrics")}
                  </th>
                )}
{viewMode.maturation && (
                  <th className="border-b border-line bg-white/70 px-3 py-3 text-xs uppercase tracking-[0.18em] text-zinc-600" colSpan={7}>
{t("maturation")}
                  </th>
                )}
              </tr>
              <tr className="text-zinc-600">
  <th className="border-b border-line px-3 py-3 relative group">
                  <button
                    onClick={() => setShowColumnFilter(showColumnFilter === "athlete" ? null : "athlete")}
                    className="flex items-center gap-1 hover:text-accent"
                  >
                    {t("datahub.player")}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  {showColumnFilter === "athlete" && (
                    <div className="absolute left-0 z-10 mt-1 min-w-[18rem] w-72 h-64 rounded-lg border border-line bg-white p-3 shadow-lg">
                      <input
                        type="text"
                        placeholder={t("datahub.searchPlayerPlaceholder")}
                        value={athleteSearch}
                        onChange={(e) => setAthleteSearch(e.target.value)}
                        className="w-full rounded border border-line px-3 py-2 text-sm placeholder:text-zinc-500"
                      />
                      <div className="mt-3 h-48 space-y-2 overflow-y-auto">
                        {state.athletes
                          .filter((athlete) =>
                            athlete.name.toLowerCase().includes(athleteSearch.toLowerCase()),
                          )
                          .slice(0, 12)
                          .map((athlete) => {
                            const checked = columnFilters.athlete.includes(athlete.name);
                            return (
                              <label
                                key={athlete.id}
                                className="flex cursor-pointer items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm text-zinc-700 hover:bg-accent/10"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleAthleteFilter(athlete.name)}
                                  className="h-4 w-4 rounded border-line text-accent"
                                />
                                <span>{athlete.name}</span>
                              </label>
                            );
                          })}
                        {state.athletes.filter((athlete) => athlete.name.toLowerCase().includes(athleteSearch.toLowerCase())).length === 0 && (
                          <p className="text-sm text-zinc-500">{t("datahub.noMatches")}</p>
                        )}
                      </div>
                      {columnFilters.athlete.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {columnFilters.athlete.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => toggleAthleteFilter(name)}
                              className="rounded-full border border-line bg-zinc-100 px-3 py-1 text-xs text-zinc-700 hover:bg-zinc-200"
                            >
                              {name} \u00d7
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </th>
                {viewMode.anthropometric && (
                  <>
                    <th className="relative border-b border-line bg-white/60 px-3 py-3">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "team" ? null : "team")}
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        {t("datahub.team")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "team" && (
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 mt-1 w-48 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-2">
                            {teams.map((team) => (
                              <label key={team} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={columnFilters.team.includes(team)}
                                  onChange={() => toggleTeamFilter(team)}
                                  className="rounded"
                                />
                                <span className="text-sm">{team}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="relative border-b border-line bg-white/60 px-3 py-3">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "position" ? null : "position")}
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        {t("datahub.position")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "position" && (
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 mt-1 w-48 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-2">
                            {positions.map((position) => (
                              <label key={position} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={columnFilters.position.includes(position)}
                                  onChange={() => togglePositionFilter(position)}
                                  className="rounded"
                                />
                                <span className="text-sm">{position}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="border-b border-line bg-white/60 px-3 py-3">{t("datahub.birthDate")}</th>
                    <th className="border-b border-line bg-white/60 px-3 py-3">{t("datahub.measurement")}</th>
                    <th className="relative border-b border-line bg-white/60 px-3 py-3">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "age" ? null : "age")}
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        {t("datahub.age")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "age" && (
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>{t("datahub.age")}</span>
                              <span>{columnFilters.age.min} - {columnFilters.age.max} {t("datahub.years")}</span>
                            </div>
                            <Range
                              step={1}
                              min={FILTER_RANGES.age.min}
                              max={FILTER_RANGES.age.max}
                              values={[columnFilters.age.min, columnFilters.age.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, age: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.age.max - FILTER_RANGES.age.min;
                                const leftPct = ((columnFilters.age.min - FILTER_RANGES.age.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.age.max - FILTER_RANGES.age.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="relative border-b border-line bg-white/60 px-3 py-3">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "stature" ? null : "stature")}
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        {t("datahub.stature")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "stature" && (
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>{t("datahub.statureFilter")}</span>
                              <span>{columnFilters.stature.min} - {columnFilters.stature.max} cm</span>
                            </div>
                            <Range
                              step={1}
                              min={FILTER_RANGES.stature.min}
                              max={FILTER_RANGES.stature.max}
                              values={[columnFilters.stature.min, columnFilters.stature.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, stature: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.stature.max - FILTER_RANGES.stature.min;
                                const leftPct = ((columnFilters.stature.min - FILTER_RANGES.stature.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.stature.max - FILTER_RANGES.stature.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="relative border-b border-line bg-white/60 px-3 py-3">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "mass" ? null : "mass")}
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        {t("datahub.massSitting")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "mass" && (
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-4">
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>{t("datahub.massFilter")}</span>
                              <span>{columnFilters.mass.min} - {columnFilters.mass.max} kg</span>
                            </div>
                            <Range
                              step={1}
                              min={FILTER_RANGES.mass.min}
                              max={FILTER_RANGES.mass.max}
                              values={[columnFilters.mass.min, columnFilters.mass.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, mass: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.mass.max - FILTER_RANGES.mass.min;
                                const leftPct = ((columnFilters.mass.min - FILTER_RANGES.mass.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.mass.max - FILTER_RANGES.mass.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>{t("datahub.sittingFilter")}</span>
                              <span>{columnFilters.sitting.min} - {columnFilters.sitting.max} cm</span>
                            </div>
                            <Range
                              step={1}
                              min={FILTER_RANGES.sitting.min}
                              max={FILTER_RANGES.sitting.max}
                              values={[columnFilters.sitting.min, columnFilters.sitting.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, sitting: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.sitting.max - FILTER_RANGES.sitting.min;
                                const leftPct = ((columnFilters.sitting.min - FILTER_RANGES.sitting.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.sitting.max - FILTER_RANGES.sitting.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                  </>
                )}
                {viewMode.maturation && (
                  <>
                    <th className="border-b border-line bg-[#eaf4f2] px-3 py-3 relative group">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "band" ? null : "band")}
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        {t("datahub.group")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "band" && (
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 mt-1 w-48 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-2">
                            {maturityBands.map((band) => (
                              <label key={band} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={columnFilters.band.includes(band)}
                                  onChange={() => toggleBandFilter(band)}
                                  className="rounded"
                                />
                                <span className="text-sm">{band}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="border-b border-line bg-[#eaf4f2] px-3 py-3 relative group">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "offset" ? null : "offset")}
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        {t("datahub.offset")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "offset" && (
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>{t("datahub.offset")}</span>
                              <span>{columnFilters.offset.min} - {columnFilters.offset.max}</span>
                            </div>
                            <Range
                              step={0.5}
                              min={FILTER_RANGES.offset.min}
                              max={FILTER_RANGES.offset.max}
                              values={[columnFilters.offset.min, columnFilters.offset.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, offset: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.offset.max - FILTER_RANGES.offset.min;
                                const leftPct = ((columnFilters.offset.min - FILTER_RANGES.offset.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.offset.max - FILTER_RANGES.offset.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="border-b border-line bg-[#eaf4f2] px-3 py-3 text-sm">
                      APHV
                    </th>
                    <th className="border-b border-line bg-[#eaf4f2] px-3 py-3 relative group">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "pah" ? null : "pah")}
                        className="flex items-center gap-1 hover:text-accent"
                      >
                        % PAH
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "pah" && (
                        <div className="absolute left-1/2 -translate-x-1/2 z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>% PAH</span>
                              <span>{columnFilters.pah.min} - {columnFilters.pah.max}%</span>
                            </div>
                            <Range
                              step={1}
                              min={FILTER_RANGES.pah.min}
                              max={FILTER_RANGES.pah.max}
                              values={[columnFilters.pah.min, columnFilters.pah.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, pah: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.pah.max - FILTER_RANGES.pah.min;
                                const leftPct = ((columnFilters.pah.min - FILTER_RANGES.pah.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.pah.max - FILTER_RANGES.pah.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="border-b border-line bg-[#eaf4f2] px-3 py-3 relative group">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "shr" ? null : "shr")}
                        className="flex items-center gap-1 hover:text-accent text-sm"
                      >
                        SHR
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "shr" && (
                        <div className="absolute right-0 left-auto z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>Sitting Height Ratio</span>
                              <span>{columnFilters.shr.min} - {columnFilters.shr.max}%</span>
                            </div>
                            <Range
                              step={1}
                              min={FILTER_RANGES.shr.min}
                              max={FILTER_RANGES.shr.max}
                              values={[columnFilters.shr.min, columnFilters.shr.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, shr: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.shr.max - FILTER_RANGES.shr.min;
                                const leftPct = ((columnFilters.shr.min - FILTER_RANGES.shr.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.shr.max - FILTER_RANGES.shr.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="border-b border-line bg-[#eaf4f2] px-3 py-3 relative group">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "whoBmi" ? null : "whoBmi")}
                        className="flex items-center gap-1 hover:text-accent text-sm"
                      >
                        WHO BMI Z
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "whoBmi" && (
                        <div className="absolute right-0 left-auto z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>WHO BMI Z-Score</span>
                              <span>{columnFilters.whoBmi.min} - {columnFilters.whoBmi.max}</span>
                            </div>
                            <Range
                              step={0.5}
                              min={FILTER_RANGES.whoBmi.min}
                              max={FILTER_RANGES.whoBmi.max}
                              values={[columnFilters.whoBmi.min, columnFilters.whoBmi.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, whoBmi: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.whoBmi.max - FILTER_RANGES.whoBmi.min;
                                const leftPct = ((columnFilters.whoBmi.min - FILTER_RANGES.whoBmi.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.whoBmi.max - FILTER_RANGES.whoBmi.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                    <th className="border-b border-line bg-[#eaf4f2] px-3 py-3 text-sm whitespace-nowrap relative group">
                      <button
                        onClick={() => setShowColumnFilter(showColumnFilter === "velocity" ? null : "velocity")}
                        className="flex items-center gap-1 hover:text-accent text-sm"
                      >
                        {t("maturationMethods.growthVelocityLabel")}
                        <ChevronDown className="h-3 w-3" />
                      </button>
                      {showColumnFilter === "velocity" && (
                        <div className="absolute right-0 left-auto z-10 mt-1 w-72 rounded-lg border border-line bg-white p-3 shadow-lg">
                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm text-zinc-600">
                              <span>{t("maturationMethods.growthVelocityLabel")} ({t("maturationMethods.growthVelocityUnit")})</span>
                              <span>{columnFilters.velocity.min} - {columnFilters.velocity.max}</span>
                            </div>
                            <Range
                              step={0.5}
                              min={FILTER_RANGES.velocity.min}
                              max={FILTER_RANGES.velocity.max}
                              values={[columnFilters.velocity.min, columnFilters.velocity.max]}
                              onChange={(values) => setColumnFilters((prev) => ({ ...prev, velocity: { min: values[0], max: values[1] } }))}
                              renderTrack={({ props, children }) => {
                                const range = FILTER_RANGES.velocity.max - FILTER_RANGES.velocity.min;
                                const leftPct = ((columnFilters.velocity.min - FILTER_RANGES.velocity.min) / range) * 100;
                                const rightPct = 100 - ((columnFilters.velocity.max - FILTER_RANGES.velocity.min) / range) * 100;
                                return (
                                  <div {...props} className="relative h-2 bg-slate-200 rounded-full">
                                    <div className="absolute inset-0 rounded-full" style={{ left: `${leftPct}%`, right: `${rightPct}%`, background: "hsl(174 60% 40% / 0.35)" }} />
                                    {children}
                                  </div>
                                );
                              }}
                              renderThumb={({ props, isDragged }) => {
                                const { key, ...rest } = props;
                                return <div key={key} {...rest} className={cn("h-4 w-4 bg-accent rounded-full border-2 border-white shadow", isDragged && "shadow-lg")} />;
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody suppressHydrationWarning>
              {(() => {
                // Band order: Pre → Mid → Post
                const BAND_ORDER = ["Pre-PHV", "Mid-PHV", "Post-PHV"] as const;
                const BAND_COLORS: Record<string, string> = {
                  "Pre-PHV": "bg-sky-50",
                  "Mid-PHV": "bg-amber-50",
                  "Post-PHV": "bg-emerald-50",
                };
                const BAND_TEXT: Record<string, string> = {
                  "Pre-PHV": "text-sky-700",
                  "Mid-PHV": "text-amber-700",
                  "Post-PHV": "text-emerald-700",
                };
                const BAND_BORDER: Record<string, string> = {
                  "Pre-PHV": "border-sky-200",
                  "Mid-PHV": "border-amber-200",
                  "Post-PHV": "border-emerald-200",
                };

                // Sort helper
                const sortRows = (rows: typeof filteredData) =>
                  [...rows].sort((a, b) => {
                    if (sortWithinGroup === "age") return a.derivedMetrics.chronologicalAge - b.derivedMetrics.chronologicalAge;
                    if (sortWithinGroup === "offset") return a.classification.primaryOffset - b.classification.primaryOffset;
                    return a.inputs.athleteName.localeCompare(b.inputs.athleteName);
                  });

                const renderRow = (row: typeof filteredData[0]) => {
                  const athlete = state.athletes.find(
                    (c) =>
                      c.id === row.inputs.athleteId ||
                      (
                        c.name.toLowerCase() === row.inputs.athleteName.toLowerCase() &&
                        c.dob === row.inputs.dob
                      ),
                  );
                  const rowAthleteId = athlete?.id ?? row.inputs.athleteId;
                  const isSelected = selectedAthleteId === rowAthleteId;
                  return (
                    <Fragment key={row.inputs.id}>
                      <tr
                        className={cn("cursor-pointer border-t border-line/70 hover:bg-white/50 transition", isSelected && "bg-accent/5")}
                        onClick={() => rowAthleteId && setSelectedAthleteId(isSelected ? null : rowAthleteId)}
                      >
                        <td className="pl-5 pr-3 py-3 font-medium text-zinc-900 text-left">
                          <span className={cn(isSelected && "text-accent")}>{row.inputs.athleteName}</span>
                        </td>
                        {viewMode.anthropometric && (
                          <>
                            <td className="bg-white/35 px-3 py-3 text-ink-soft">{row.inputs.teamName ?? "--"}</td>
                            <td className="bg-white/35 px-3 py-3 text-ink-soft">{athlete?.position ?? row.inputs.position ?? "--"}</td>
                            <td className="bg-white/35 px-3 py-3 text-ink-soft" suppressHydrationWarning>{formatDate(row.inputs.dob)}</td>
                            <td className="bg-white/35 px-3 py-3 text-ink-soft" suppressHydrationWarning>{formatDate(row.inputs.dataCollectionDate)}</td>
                            <td className="bg-white/35 px-3 py-3">{formatNumber(row.derivedMetrics.chronologicalAge, 2)}</td>
                            <td className="bg-white/35 px-3 py-3">{formatNumber(row.inputs.statureCm, 1)} cm</td>
                            <td className="bg-white/35 px-3 py-3">{formatNumber(row.inputs.bodyMassKg, 1)} kg / {formatNumber(row.inputs.sittingHeightCm, 1)} cm</td>
                          </>
                        )}
                        {viewMode.maturation && (
                          <>
                            <td className="bg-[#eaf4f2] px-3 py-3 text-center font-medium">{row.classification.maturityBand}</td>
                            <td className="bg-[#eaf4f2] px-3 py-3 text-center">{formatNumber(row.classification.primaryOffset, 2)}</td>
                            {/* APHV (single column with method indicator) */}
                            <td className="bg-[#eaf4f2] px-3 py-3 text-center">
                              {(() => {
                                const athleteSex = athlete && athlete.sex === "female" ? "female" : "male";
                                const profile = createUnifiedProfile(row, selectedEngine, bioBandingStrategy, athleteSex);
                                return (
                                  <div className="space-y-0.5">
                                    <div className="font-medium">
                                      {profile.aphv !== null
                                        ? formatNumber(profile.aphv, 2)
                                        : "—"}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                      {translateEngineLabel(profile.selectedEngine)}
                                    </div>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="bg-[#eaf4f2] px-3 py-3 text-center">{formatNumber(row.methodOutputs.percentageAdultHeight, 2)}</td>
                            <td className="bg-[#eaf4f2] px-3 py-3 text-center">{formatNumber(row.derivedMetrics.sittingHeightRatio, 1)}</td>
                            <td className="bg-[#eaf4f2] px-3 py-3 text-center">{row.classification.whoBmiZScore !== null ? formatNumber(row.classification.whoBmiZScore, 2) : "—"}</td>
                            <td className="bg-[#eaf4f2] px-3 py-3 text-center">
                              {row.derivedMetrics.growthVelocityCmPerYear != null
                                ? formatNumber(row.derivedMetrics.growthVelocityCmPerYear, 1)
                                : <span className="text-slate-300">—</span>}
                            </td>
                          </>
                        )}
                      </tr>
                    </Fragment>
                  );
                };

                const totalCols = 1 + (viewMode.anthropometric ? 7 : 0) + (viewMode.maturation ? 7 : 0);

                // No grouping at all
                if (!groupByTeam && !groupByPHV) {
                  return sortRows(filteredData).map(renderRow);
                }

                // PHV only (no team grouping)
                if (!groupByTeam && groupByPHV) {
                  return BAND_ORDER.map((band) => {
                    const bandRows = sortRows(filteredData.filter((r) => r.classification.maturityBand === band));
                    if (bandRows.length === 0) return null;
                    return (
                      <Fragment key={band}>
                        <tr>
                          <td className={`pl-5 pr-3 py-1.5 text-left border-t-2 border-zinc-200 ${BAND_COLORS[band]}`}>
                            <span className={`text-xs font-semibold ${BAND_TEXT[band]}`}>{band}</span>
                            <span className={`ml-1.5 text-xs ${BAND_TEXT[band]} opacity-70`}>({bandRows.length})</span>
                          </td>
                          {totalCols > 1 && <td colSpan={totalCols - 1} className={`border-t-2 border-zinc-200 ${BAND_COLORS[band]}`}></td>}
                        </tr>
                        {bandRows.map(renderRow)}
                      </Fragment>
                    );
                  });
                }

                // Team only (no PHV sub-grouping)
                const teamNames = Array.from(new Set(filteredData.map((r) => r.inputs.teamName ?? ""))).sort();

                if (groupByTeam && !groupByPHV) {
                  return teamNames.map((team) => {
                    const teamRows = sortRows(filteredData.filter((r) => (r.inputs.teamName ?? "") === team));
                    if (teamRows.length === 0) return null;
                    return (
                      <Fragment key={team || "__no_team__"}>
                        <tr>
                          <td className="bg-zinc-100 border-t-2 border-zinc-300 pl-5 pr-3 py-2 text-left">
                            <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                              {team || t("datahub.noTeam")}
                            </span>
                            <span className="ml-2 text-xs text-zinc-400">({teamRows.length})</span>
                          </td>
                          {totalCols > 1 && <td colSpan={totalCols - 1} className="bg-zinc-100 border-t-2 border-zinc-300"></td>}
                        </tr>
                        {teamRows.map(renderRow)}
                      </Fragment>
                    );
                  });
                }

                // Both: team → PHV band
                return teamNames.map((team) => {
                  const teamRows = filteredData.filter((r) => (r.inputs.teamName ?? "") === team);
                  if (teamRows.length === 0) return null;
                  return (
                    <Fragment key={team || "__no_team__"}>
                      <tr>
                        <td className="bg-zinc-100 border-t-2 border-zinc-300 pl-5 pr-3 py-2 text-left">
                          <span className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                            {team || t("datahub.noTeam")}
                          </span>
                          <span className="ml-2 text-xs text-zinc-400">({teamRows.length})</span>
                        </td>
                        {totalCols > 1 && <td colSpan={totalCols - 1} className="bg-zinc-100 border-t-2 border-zinc-300"></td>}
                      </tr>
                      {BAND_ORDER.map((band) => {
                        const bandRows = sortRows(teamRows.filter((r) => r.classification.maturityBand === band));
                        if (bandRows.length === 0) return null;
                        return (
                          <Fragment key={band}>
                            <tr>
                              <td className={`pl-5 pr-3 py-1.5 text-left border-t border-zinc-200 ${BAND_COLORS[band]}`}>
                                <span className={`text-xs font-semibold ${BAND_TEXT[band]}`}>{band}</span>
                                <span className={`ml-1.5 text-xs ${BAND_TEXT[band]} opacity-70`}>({bandRows.length})</span>
                              </td>
                              {totalCols > 1 && <td colSpan={totalCols - 1} className={`border-t border-zinc-200 ${BAND_COLORS[band]}`}></td>}
                            </tr>
                            {bandRows.map(renderRow)}
                          </Fragment>
                        );
                      })}
                    </Fragment>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </section>

      {/* Athlete detail modal — same pattern as add-measurement */}
      {selectedAthleteId && (() => {
        const athlete = state.athletes.find((a) => a.id === selectedAthleteId);
        if (!athlete) return null;
        const history = assessments
          .filter((r) =>
            r.inputs.athleteId === selectedAthleteId ||
            (
              r.inputs.athleteName.toLowerCase() === athlete.name.toLowerCase() &&
              r.inputs.dob === athlete.dob
            )
          )
          .sort((a, b) => a.inputs.dataCollectionDate.localeCompare(b.inputs.dataCollectionDate));
        const latest = history.length > 0 ? history[history.length - 1] : null;
        const chartData = history.map((r) => ({
          date: r.inputs.dataCollectionDate.slice(0, 7),
          stature: r.inputs.statureCm,
          offset: parseFloat(r.classification.primaryOffset.toFixed(2)),
          pah: r.methodOutputs.percentageAdultHeight,
        }));
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200"
            onClick={() => { setSelectedAthleteId(null); setEditingRecord(null); }}
          >
            <div
              className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-line shrink-0">
                <div className="flex items-center gap-4">
                  {athlete.photoUrl ? (
                    <img src={athlete.photoUrl} alt={athlete.name} className="h-14 w-14 rounded-full object-cover border border-line flex-shrink-0" />
                  ) : (
                    <div className="h-14 w-14 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center flex-shrink-0">
                      <span className="text-xl font-bold text-zinc-400">{athlete.name.charAt(0)}</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-zinc-900">{athlete.name}</h3>
                    <p className="text-sm text-zinc-500 mt-0.5">{athlete.teamName ?? "—"} · {athlete.position ?? "—"} · {athlete.sex === "male" ? t("datahub.male") : t("datahub.female")}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedAthleteId(null); setEditingRecord(null); }}
                  className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable body */}
              <div className="overflow-y-auto px-6 py-5 space-y-6">
                {/* Latest measurements */}
                {latest ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">{t("datahub.measurement")} — {formatDate(latest.inputs.dataCollectionDate)}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: t("datahub.stature"), value: `${formatNumber(latest.inputs.statureCm, 1)} cm` },
                        { label: t("datahub.bodyMassKg"), value: `${formatNumber(latest.inputs.bodyMassKg, 1)} kg` },
                        { label: t("datahub.sittingHeightCm"), value: `${formatNumber(latest.inputs.sittingHeightCm, 1)} cm` },
                        { label: t("datahub.group"), value: latest.classification.maturityBand, accent: true },
                        { label: t("datahub.offset"), value: formatNumber(latest.classification.primaryOffset, 2) ?? "—" },
                        { label: "% PAH", value: latest.methodOutputs.percentageAdultHeight !== null ? `${formatNumber(latest.methodOutputs.percentageAdultHeight, 1)}%` : "—" },
                        { label: t("datahub.age"), value: `${formatNumber(latest.derivedMetrics.chronologicalAge, 2)} ${t("datahub.years")}` },
                        { label: "Mirwald", value: formatNumber(latest.methodOutputs.mirwaldOffset, 2) ?? "—" },
                      ].map(({ label, value, accent }) => (
                        <div key={label} className="rounded-xl bg-zinc-50 px-3 py-2.5">
                          <p className="text-xs text-zinc-500 mb-0.5">{label}</p>
                          <p className={cn("text-sm font-semibold", accent ? "text-accent" : "text-zinc-900")}>{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-400 text-center py-4">{t("datahub.noData") || "Sin mediciones registradas."}</p>
                )}

                {/* Edit latest measurement */}
                {latest && (
                  <div>
                    {editingRecord?.id === latest.inputs.id ? (
                      <div className="rounded-xl border border-accent/20 bg-accent/5 p-4 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-accent mb-1">{t("datahub.editPlayerTitle")}</p>
                        <FormErrorBanner summary={inlineEditSummary} fieldErrors={inlineEditErrors} t={t} />
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.measurement")}</label>
                            <input type="date" value={editingRecord.dataCollectionDate} onChange={(e) => setEditingRecord((r) => r ? { ...r, dataCollectionDate: e.target.value } : r)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.statureCm")}</label>
                            <input type="number" step="0.1" value={editingRecord.statureCm || ""} onChange={(e) => setEditingRecord((r) => r ? { ...r, statureCm: parseFloat(e.target.value) || 0 } : r)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.bodyMassKg")}</label>
                            <input type="number" step="0.1" value={editingRecord.bodyMassKg || ""} onChange={(e) => setEditingRecord((r) => r ? { ...r, bodyMassKg: parseFloat(e.target.value) || 0 } : r)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.sittingHeightCm")}</label>
                            <input type="number" step="0.1" value={editingRecord.sittingHeightCm || ""} onChange={(e) => setEditingRecord((r) => r ? { ...r, sittingHeightCm: parseFloat(e.target.value) || 0 } : r)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.motherHeightCm")}</label>
                            <input type="number" step="0.1" value={editingRecord.motherHeightCm ?? ""} onChange={(e) => setEditingRecord((r) => r ? { ...r, motherHeightCm: e.target.value ? parseFloat(e.target.value) : null } : r)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-zinc-500 mb-1">{t("datahub.fatherHeightCm")}</label>
                            <input type="number" step="0.1" value={editingRecord.fatherHeightCm ?? ""} onChange={(e) => setEditingRecord((r) => r ? { ...r, fatherHeightCm: e.target.value ? parseFloat(e.target.value) : null } : r)} className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent/50 font-sans" />
                          </div>
                          <div className="col-span-2">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={editingRecord.parentalHeightsReported !== false}
                                onChange={(e) => setEditingRecord((r) => r ? { ...r, parentalHeightsReported: e.target.checked } : r)}
                                className="h-4 w-4 rounded border-zinc-300 accent-accent"
                              />
                              <span className="text-xs text-zinc-500">
                                {t("maturationMethods.parentalHeightsReported")} <span className="text-zinc-400">{t("maturationMethods.parentalHeightsReportedHintInline")}</span>
                              </span>
                            </label>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button type="button" onClick={() => setEditingRecord(null)} className="flex-1 rounded-xl border border-line py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition">{t("datahub.cancel")}</button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!editingRecord) return;
                              const result = validateAnthropometric(t, editingRecord);
                              if (!result.success) {
                                setInlineEditErrors(result.fieldErrors);
                                setInlineEditSummary(result.summary);
                                return;
                              }
                              const { id, ...updates } = editingRecord;
                              updateRecord(id, updates);
                              setEditingRecord(null);
                              setInlineEditErrors({});
                              setInlineEditSummary("");
                            }}
                            disabled={!canEditAnthropometry}
                            className="flex-1 rounded-xl bg-accent py-2 text-sm font-medium text-slate-950 hover:bg-accent-strong transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {t("datahub.save")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecord({ ...latest.inputs });
                          setInlineEditErrors({});
                          setInlineEditSummary("");
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded-xl border border-line py-2.5 text-sm font-medium text-zinc-600 hover:border-accent hover:text-accent hover:bg-accent/5 transition"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        {t("datahub.edit")} {t("datahub.measurement").toLowerCase()}
                      </button>
                    )}
                  </div>
                )}

                {/* Evolutionary charts */}
                {chartData.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-3">{t("datahub.historyMeasurements")}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-zinc-500 mb-1 text-center">{t("datahub.stature")} (cm)</p>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Line type="monotone" dataKey="stature" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1 text-center">{t("datahub.offset")}</p>
                        <ResponsiveContainer width="100%" height={120}>
                          <LineChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                            <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                            <Line type="monotone" dataKey="offset" stroke="#14b8a6" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                      {chartData.some((d) => d.pah !== null) && (
                        <div>
                          <p className="text-xs text-zinc-500 mb-1 text-center">% PAH</p>
                          <ResponsiveContainer width="100%" height={120}>
                            <LineChart data={chartData.filter((d) => d.pah !== null)} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} />
                              <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                              <Line type="monotone" dataKey="pah" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* History table */}
                {history.length > 1 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 mb-2">{t("datahub.historyMeasurements")} ({history.length})</p>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-max text-xs text-left">
                        <thead>
                          <tr className="text-zinc-400 border-b border-line">
                            <th className="py-1.5 pr-4 font-medium">{t("datahub.date")}</th>
                            <th className="py-1.5 pr-4 font-medium">{t("datahub.stature")}</th>
                            <th className="py-1.5 pr-4 font-medium">{t("datahub.bodyMassKg")}</th>
                            <th className="py-1.5 pr-4 font-medium">Sit. cm</th>
                            <th className="py-1.5 pr-4 font-medium">{t("datahub.group")}</th>
                            <th className="py-1.5 pr-4 font-medium">{t("datahub.offset")}</th>
                            <th className="py-1.5 font-medium">%PAH</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...history].reverse().map((r) => (
                            <tr key={r.inputs.id} className="border-t border-line/40">
                              <td className="py-1.5 pr-4 text-zinc-600">{formatDate(r.inputs.dataCollectionDate)}</td>
                              <td className="py-1.5 pr-4">{formatNumber(r.inputs.statureCm, 1)} cm</td>
                              <td className="py-1.5 pr-4">{formatNumber(r.inputs.bodyMassKg, 1)} kg</td>
                              <td className="py-1.5 pr-4">{formatNumber(r.inputs.sittingHeightCm, 1)} cm</td>
                              <td className="py-1.5 pr-4 font-medium">{r.classification.maturityBand}</td>
                              <td className="py-1.5 pr-4">{formatNumber(r.classification.primaryOffset, 2)}</td>
                              <td className="py-1.5">{r.methodOutputs.percentageAdultHeight !== null ? `${formatNumber(r.methodOutputs.percentageAdultHeight, 1)}%` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Add Measurement */}
      {showAddMeasurementModal && (
        <ModalShell
          title={t("datahub.addMeasurementTitle")}
          body={t("datahub.addMeasurementBody")}
          onClose={() => { setShowAddMeasurementModal(false); setEditingAthleteId(null); }}
          downloadTemplate={() => downloadMeasurementsTemplate(downloadTeams)}
          downloadLabel={t("common.downloadTemplate")}
          uploadLabel={t("datahub.uploadExcel")}
          fileRef={measurementsFileRef}
          onUploadClick={() => measurementsFileRef.current?.click()}
          onUploadChange={importMeasurementsFile}
          feedback={feedback}
          fieldErrors={fieldErrors}
          formSummary={formSummary}
          teams={[...new Set(state.athletes.map((a) => a.teamName).filter(Boolean))] as string[]}
          downloadTeams={downloadTeams}
          setDownloadTeams={setDownloadTeams}
          t={t}
        >
          <form onSubmit={saveMaturation} className="space-y-6" noValidate>
            <AthleteSelector
              editingAthleteId={editingAthleteId}
              setEditingAthleteId={setEditingAthleteId}
              athletes={state.athletes}
              setMaturationForm={setMaturationForm}
              emptyForm={emptyForm}
              clubName={state.club.name}
              fieldError={fieldErrors.athleteName}
              latestParentHeights={(() => {
                const map: Record<string, { motherHeightCm?: number | null; fatherHeightCm?: number | null }> = {};
                for (const rec of assessments) {
                  const prev = map[rec.inputs.athleteId];
                  if (!prev || rec.inputs.dataCollectionDate > (prev as { _date?: string })._date!) {
                    map[rec.inputs.athleteId] = {
                      motherHeightCm: rec.inputs.motherHeightCm,
                      fatherHeightCm: rec.inputs.fatherHeightCm,
                      _date: rec.inputs.dataCollectionDate,
                    } as { motherHeightCm?: number | null; fatherHeightCm?: number | null; _date?: string };
                  }
                }
                return map;
              })()}
              t={t}
            />
            <AddMeasurementFormBody
              maturationForm={maturationForm}
              setMaturationValue={setMaturationValue}
              fieldErrors={fieldErrors}
              onCancel={() => { setShowAddMeasurementModal(false); setEditingAthleteId(null); }}
              t={t}
              canEditAnthropometry={canEditAnthropometry}
            />
          </form>
        </ModalShell>
      )}

      {/* Modal: Edit Player */}
      {showEditPlayerModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-modal-title"
          onKeyDown={(e) => { if (e.key === "Escape") { setShowEditPlayerModal(false); setEditingAthleteId(null); } }}
        >
          <div
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative mb-6">
              <h3 id="edit-modal-title" className="text-xl font-semibold">{t("datahub.editPlayerTitle")}</h3>
              <p className="text-sm text-zinc-600">{t("datahub.editPlayerBody")}</p>
              <button
                type="button"
                onClick={() => { setShowEditPlayerModal(false); setEditingAthleteId(null); }}
                className="absolute top-0 right-0 rounded-full p-1 text-red-500 hover:bg-red-50 transition"
                aria-label={t("datahub.close")}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={saveEditPlayer} className="space-y-6" noValidate>
              <FormErrorBanner summary={formSummary} fieldErrors={fieldErrors} t={t} />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label htmlFor="edit-player-name" className="block text-sm font-medium text-zinc-700">{t("datahub.playerName")}</label>
                  <input
                    id="edit-player-name"
                    type="text"
                    readOnly
                    value={maturationForm.athleteName}
                    className="mt-1 w-full rounded-lg border border-line bg-zinc-50 px-3 py-2 text-zinc-500 font-sans"
                  />
                </div>

                <div>
                  <label htmlFor="edit-player-sex" className="block text-sm font-medium text-zinc-700">{t("datahub.sex")}</label>
                  <select
                    id="edit-player-sex"
                    value={maturationForm.sex}
                    onChange={(e) => setMaturationValue("sex", e.target.value as "male" | "female")}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 font-sans"
                  >
                    <option value="male">{t("datahub.male")}</option>
                    <option value="female">{t("datahub.female")}</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="edit-player-age-group" className="block text-sm font-medium text-zinc-700">{t("datahub.ageGroup")}</label>
                  <input
                    id="edit-player-age-group"
                    type="text"
                    value={maturationForm.ageGroup}
                    onChange={(e) => setMaturationValue("ageGroup", e.target.value)}
                    className={cn("mt-1 w-full rounded-lg border px-3 py-2 placeholder:text-zinc-500 font-sans", fieldErrors.ageGroup ? invalidInputClass : "border-line")}
                  />
                  <FieldError message={fieldErrors.ageGroup} />
                </div>

                <div>
                  <label htmlFor="edit-player-team" className="block text-sm font-medium text-zinc-700">{t("datahub.team")}</label>
                  <input
                    id="edit-player-team"
                    type="text"
                    value={maturationForm.teamName || ""}
                    onChange={(e) => setMaturationValue("teamName", e.target.value)}
                    className={cn("mt-1 w-full rounded-lg border px-3 py-2 placeholder:text-zinc-500 font-sans", fieldErrors.teamName ? invalidInputClass : "border-line")}
                  />
                  <FieldError message={fieldErrors.teamName} />
                </div>

                <div>
                  <label htmlFor="edit-player-position" className="block text-sm font-medium text-zinc-700">{t("datahub.position")}</label>
                  <input
                    id="edit-player-position"
                    type="text"
                    value={maturationForm.position || ""}
                    onChange={(e) => setMaturationValue("position", e.target.value)}
                    className="mt-1 w-full rounded-lg border border-line px-3 py-2 placeholder:text-zinc-500 font-sans"
                  />
                </div>

                <div>
                  <label htmlFor="edit-player-dob" className="block text-sm font-medium text-zinc-700">{t("datahub.birthDate")}</label>
                  <input
                    id="edit-player-dob"
                    type="date"
                    value={maturationForm.dob}
                    onChange={(e) => setMaturationValue("dob", e.target.value)}
                    className={cn("mt-1 w-full rounded-lg border px-3 py-2 placeholder:text-zinc-500 font-sans", fieldErrors.dob ? invalidInputClass : "border-line")}
                  />
                  <FieldError message={fieldErrors.dob} />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowEditPlayerModal(false); setEditingAthleteId(null); }}
                  className="rounded-lg border border-line px-4 py-2 text-zinc-700 hover:bg-gray-50"
                >
                  {t("datahub.cancel")}
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-accent px-4 py-2 text-white hover:bg-accent/90"
                >
                  {t("datahub.savePlayer")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

function ModalShell({
  title,
  body,
  onClose,
  downloadTemplate,
  downloadLabel,
  uploadLabel,
  fileRef,
  onUploadClick,
  onUploadChange,
  feedback,
  fieldErrors,
  formSummary,
  teams,
  downloadTeams,
  setDownloadTeams,
  t,
  children,
}: {
  title: string;
  body: string;
  onClose: () => void;
  downloadTemplate: () => void;
  downloadLabel: string;
  uploadLabel: string;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onUploadChange: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  feedback: string;
  fieldErrors?: FieldErrors;
  formSummary?: string;
  teams?: string[];
  downloadTeams?: string[];
  setDownloadTeams?: (teams: string[]) => void;
  t: (key: string) => string;
  children: React.ReactNode;
}) {
  const toggleTeam = (team: string) => {
    if (!setDownloadTeams || !downloadTeams) return;
    setDownloadTeams(
      downloadTeams.includes(team)
        ? downloadTeams.filter((t) => t !== team)
        : [...downloadTeams, team]
    );
  };

  const selectAll = () => {
    if (!setDownloadTeams || !teams) return;
    setDownloadTeams([...teams]);
  };

  const clearAll = () => {
    if (!setDownloadTeams) return;
    setDownloadTeams([]);
  };

  const [isDragging, setIsDragging] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const mockEvent = {
          target: { files: [file] }
        } as unknown as React.ChangeEvent<HTMLInputElement>;
        await onUploadChange(mockEvent);
      }
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 relative">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 id="modal-title" className="text-xl font-bold text-zinc-900">{title}</h3>
              <p className="text-sm text-zinc-600 mt-0.5">{body}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0 ml-4"
              aria-label={t("datahub.close")}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            className={cn(
              "rounded-xl border border-dashed p-4 space-y-3 transition-colors",
              isDragging ? "border-emerald-500 bg-emerald-50" : "border-zinc-300 bg-zinc-50"
            )}
          >
            {/* Team selector */}
            {teams && teams.length > 0 && setDownloadTeams && downloadTeams !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-zinc-700">{t("datahub.selectTeamsForDownload") || "Seleccionar equipos para la plantilla"}</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={selectAll} className="text-xs text-accent hover:underline">{t("datahub.selectAll") || "Todos"}</button>
                    <span className="text-zinc-300">|</span>
                    <button type="button" onClick={clearAll} className="text-xs text-zinc-500 hover:underline">{t("datahub.clearAll") || "Ninguno"}</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {teams.map((team) => {
                    const selected = downloadTeams.includes(team);
                    return (
                      <button
                        key={team}
                        type="button"
                        onClick={() => toggleTeam(team)}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition",
                          selected
                            ? "border-accent bg-accent/10 text-accent"
                            : "border-line bg-white text-zinc-600 hover:border-accent/50 hover:bg-accent/5"
                        )}
                      >
                        <span className={cn("h-2 w-2 rounded-full flex-shrink-0", selected ? "bg-accent" : "bg-zinc-300")} />
                        {team}
                      </button>
                    );
                  })}
                </div>
                {downloadTeams.length === 0 && (
                  <p className="text-xs text-zinc-400 mt-1">{t("datahub.allTeamsIfNone") || "Si no seleccionas ninguno, se incluirán todos los jugadores."}</p>
                )}
              </div>
            )}

            {/* Download + Upload buttons */}
            <div>
              <p className="text-sm text-zinc-600 mb-3 text-center">{t("datahub.bulkAddTitle")}</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 rounded-lg bg-white border border-line px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
                  aria-label={downloadLabel}
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  {downloadLabel}
                </button>
                <label className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 cursor-pointer transition shadow-sm">
                  <UploadCloud className="h-4 w-4" aria-hidden="true" />
                  {uploadLabel}
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={onUploadChange} />
                </label>
              </div>
              {feedback && (() => {
                let text = feedback;
                let ok = feedback === "saved" || feedback.startsWith("imported:") || feedback.startsWith("import-partial:");
                if (feedback === "saved") text = t("datahub.playerAddedOk");
                else if (feedback === "duplicate") text = t("datahub.measurementExists");
                else if (feedback.startsWith("imported:")) {
                  text = t("datahub.importedRows").replace("{count}", feedback.split(":")[1] ?? "0");
                } else if (feedback.startsWith("import-partial:")) {
                  const [, imported, skipped] = feedback.split(":");
                  text = t("datahub.importMeasurementsPartial")
                    .replace("{imported}", imported ?? "0")
                    .replace("{skipped}", skipped ?? "0");
                } else if (feedback.startsWith("import-none:")) {
                  text = t("datahub.importMeasurementsNone");
                  ok = false;
                }
                return (
                  <div className={cn("mt-3 p-2 text-center text-sm font-medium rounded-lg", ok ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800")}>
                    {text}
                  </div>
                );
              })()}
            </div>
          </div>

          <div className="flex items-center gap-4 py-3">
            <div className="h-px bg-line flex-1"></div>
            <span className="text-xs font-semibold uppercase text-zinc-400">{t("datahub.bulkAddManualOpts")}</span>
            <div className="h-px bg-line flex-1"></div>
          </div>
        </div>
        {(formSummary || (fieldErrors && Object.keys(fieldErrors).length > 0)) && (
          <FormErrorBanner summary={formSummary} fieldErrors={fieldErrors} t={t} className="mb-4" />
        )}
        {children}

      </div>
    </div>
  );
}

function maturationInputClass(hasError: boolean) {
  return cn(
    "rounded-2xl border bg-white/70 px-4 py-3 text-zinc-700 font-sans w-full outline-none focus:border-accent/50",
    hasError ? invalidInputClass : "border-line",
  );
}

function AddPlayerFormBody({
  maturationForm,
  setMaturationValue,
  onCancel,
  t,
}: {
  maturationForm: AnthropometricRecordInput;
  setMaturationValue: <K extends keyof AnthropometricRecordInput>(key: K, value: AnthropometricRecordInput[K]) => void;
  onCancel: () => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <LabeledField label={t("datahub.playerName")}>
          <input type="text" required placeholder={t("datahub.examplePlayerName")} value={maturationForm.athleteName} onChange={(e) => setMaturationValue("athleteName", e.target.value)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700 font-sans" />
        </LabeledField>
        <LabeledField label={t("datahub.sex")}>
          <select required value={maturationForm.sex} onChange={(e) => setMaturationValue("sex", e.target.value as "male" | "female")} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700 font-sans">
            <option value="male">{t("datahub.male")}</option>
            <option value="female">{t("datahub.female")}</option>
          </select>
        </LabeledField>
        <LabeledField label={t("datahub.ageGroup")}>
          <input type="text" required placeholder={t("datahub.exampleAgeGroup")} value={maturationForm.ageGroup} onChange={(e) => setMaturationValue("ageGroup", e.target.value)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.team")}>
          <input type="text" placeholder={t("datahub.exampleTeam")} value={maturationForm.teamName || ""} onChange={(e) => setMaturationValue("teamName", e.target.value)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.position")}>
          <input type="text" placeholder={t("datahub.examplePosition")} value={maturationForm.position || ""} onChange={(e) => setMaturationValue("position", e.target.value)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.birthDate")}>
          <input type="date" required value={maturationForm.dob} onChange={(e) => setMaturationValue("dob", e.target.value)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.measurement")}>
          <input type="date" required value={maturationForm.dataCollectionDate} onChange={(e) => setMaturationValue("dataCollectionDate", e.target.value)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.statureCm")}>
          <input type="number" step="0.1" required placeholder={t("datahub.exampleStature")} value={maturationForm.statureCm || ""} onChange={(e) => setMaturationValue("statureCm", parseFloat(e.target.value) || 0)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.bodyMassKg")}>
          <input type="number" step="0.1" required placeholder={t("datahub.exampleMass")} value={maturationForm.bodyMassKg || ""} onChange={(e) => setMaturationValue("bodyMassKg", parseFloat(e.target.value) || 0)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.sittingHeightCm")}>
          <input type="number" step="0.1" required placeholder={t("datahub.exampleSittingHeight")} value={maturationForm.sittingHeightCm || ""} onChange={(e) => setMaturationValue("sittingHeightCm", parseFloat(e.target.value) || 0)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.motherHeightCm")}>
          <input type="number" step="0.1" placeholder={t("datahub.exampleParentHeight")} value={maturationForm.motherHeightCm || ""} onChange={(e) => setMaturationValue("motherHeightCm", parseFloat(e.target.value) || null)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <LabeledField label={t("datahub.fatherHeightCm")}>
          <input type="number" step="0.1" placeholder={t("datahub.exampleParentHeight")} value={maturationForm.fatherHeightCm || ""} onChange={(e) => setMaturationValue("fatherHeightCm", parseFloat(e.target.value) || null)} className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700" />
        </LabeledField>
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer select-none mt-1">
            <input
              type="checkbox"
              checked={maturationForm.parentalHeightsReported !== false}
              onChange={(e) => setMaturationValue("parentalHeightsReported", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-accent"
            />
            <span className="text-xs text-zinc-500">
              {t("maturationMethods.parentalHeightsReported")} <span className="text-zinc-400">{t("maturationMethods.parentalHeightsReportedHintForm")}</span>
            </span>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-zinc-700 hover:bg-gray-50">{t("datahub.cancel")}</button>
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-white hover:bg-accent/90">{t("datahub.savePlayer")}</button>
      </div>
    </>
  );
}

function AthleteSelector({
  editingAthleteId,
  setEditingAthleteId,
  athletes,
  setMaturationForm,
  emptyForm,
  clubName,
  latestParentHeights,
  fieldError,
  t,
}: {
  editingAthleteId: string | null;
  setEditingAthleteId: (id: string | null) => void;
  athletes: Array<{ id: string; name: string; sex: string; ageGroup: string; teamName?: string; position?: string; dob: string }>;
  setMaturationForm: (form: AnthropometricRecordInput) => void;
  emptyForm: AnthropometricRecordInput;
  clubName: string;
  latestParentHeights: Record<string, { motherHeightCm?: number | null; fatherHeightCm?: number | null }>;
  fieldError?: string;
  t: (key: string) => string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedAthlete = athletes.find((a) => a.id === editingAthleteId);
  const filtered = query.trim()
    ? athletes.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()))
    : athletes;

  function selectAthlete(athlete: typeof athletes[0]) {
    setEditingAthleteId(athlete.id);
    setQuery(athlete.name);
    setOpen(false);
    const prevParents = latestParentHeights[athlete.id] ?? {};
    setMaturationForm({
      ...emptyForm,
      athleteId: athlete.id,
      athleteName: athlete.name,
      sex: athlete.sex as "male" | "female",
      ageGroup: athlete.ageGroup,
      clubName,
      teamName: athlete.teamName,
      position: athlete.position,
      dob: athlete.dob,
      motherHeightCm: prevParents.motherHeightCm ?? null,
      fatherHeightCm: prevParents.fatherHeightCm ?? null,
    });
  }

  return (
    <div className="mb-4 relative">
      <LabeledField label={t("datahub.selectAthlete")} error={fieldError}>
        <input
          type="text"
          autoComplete="off"
          placeholder={t("datahub.searchPlayerPlaceholder")}
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!e.target.value) setEditingAthleteId(null); }}
          className={maturationInputClass(Boolean(fieldError))}
        />
      </LabeledField>
      {open && filtered.length > 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-line bg-white shadow-lg max-h-52 overflow-y-auto">
          {filtered.slice(0, 20).map((a) => (
            <button
              key={a.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); selectAthlete(a); }}
              className={cn(
                "w-full text-left px-4 py-2.5 text-sm hover:bg-accent/5 transition",
                a.id === editingAthleteId && "bg-accent/10 text-accent font-medium"
              )}
            >
              <span className="font-medium">{a.name}</span>
              {a.teamName && <span className="ml-2 text-xs text-zinc-400">{a.teamName}</span>}
            </button>
          ))}
        </div>
      )}
      {selectedAthlete && query === selectedAthlete.name && (
        <p className="mt-1 text-xs text-zinc-500 px-1">
          {selectedAthlete.teamName ?? "—"} · {selectedAthlete.sex === "male" ? t("datahub.male") : t("datahub.female")} · {selectedAthlete.dob}
        </p>
      )}
    </div>
  );
}

function AddMeasurementFormBody({
  maturationForm,
  setMaturationValue,
  fieldErrors,
  onCancel,
  t,
  canEditAnthropometry = true,
}: {
  maturationForm: AnthropometricRecordInput;
  setMaturationValue: <K extends keyof AnthropometricRecordInput>(key: K, value: AnthropometricRecordInput[K]) => void;
  fieldErrors: FieldErrors;
  onCancel: () => void;
  t: (key: string) => string;
  canEditAnthropometry?: boolean;
}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <LabeledField label={t("datahub.measurement")} error={fieldErrors.dataCollectionDate}>
          <input type="date" required value={maturationForm.dataCollectionDate} onChange={(e) => setMaturationValue("dataCollectionDate", e.target.value)} className={maturationInputClass(Boolean(fieldErrors.dataCollectionDate))} />
        </LabeledField>
        <LabeledField label={t("datahub.statureCm")} error={fieldErrors.statureCm}>
          <input type="number" step="0.1" required placeholder={t("datahub.exampleStature")} value={maturationForm.statureCm || ""} onChange={(e) => setMaturationValue("statureCm", parseFloat(e.target.value) || 0)} className={maturationInputClass(Boolean(fieldErrors.statureCm))} />
        </LabeledField>
        <LabeledField label={t("datahub.bodyMassKg")} error={fieldErrors.bodyMassKg}>
          <input type="number" step="0.1" required placeholder={t("datahub.exampleMass")} value={maturationForm.bodyMassKg || ""} onChange={(e) => setMaturationValue("bodyMassKg", parseFloat(e.target.value) || 0)} className={maturationInputClass(Boolean(fieldErrors.bodyMassKg))} />
        </LabeledField>
        <LabeledField label={t("datahub.sittingHeightCm")} error={fieldErrors.sittingHeightCm}>
          <input type="number" step="0.1" required placeholder={t("datahub.exampleSittingHeight")} value={maturationForm.sittingHeightCm || ""} onChange={(e) => setMaturationValue("sittingHeightCm", parseFloat(e.target.value) || 0)} className={maturationInputClass(Boolean(fieldErrors.sittingHeightCm))} />
        </LabeledField>
        <LabeledField label={t("datahub.motherHeightCm")} error={fieldErrors.motherHeightCm}>
          <input type="number" step="0.1" placeholder={t("datahub.exampleParentHeight")} value={maturationForm.motherHeightCm ?? ""} onChange={(e) => setMaturationValue("motherHeightCm", e.target.value ? parseFloat(e.target.value) : null)} className={maturationInputClass(Boolean(fieldErrors.motherHeightCm))} />
        </LabeledField>
        <LabeledField label={t("datahub.fatherHeightCm")} error={fieldErrors.fatherHeightCm}>
          <input type="number" step="0.1" placeholder={t("datahub.exampleParentHeight")} value={maturationForm.fatherHeightCm ?? ""} onChange={(e) => setMaturationValue("fatherHeightCm", e.target.value ? parseFloat(e.target.value) : null)} className={maturationInputClass(Boolean(fieldErrors.fatherHeightCm))} />
        </LabeledField>
        <div className="col-span-2 flex items-center">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={maturationForm.parentalHeightsReported !== false}
              onChange={(e) => setMaturationValue("parentalHeightsReported", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-accent"
            />
            <span className="text-xs text-zinc-500">
              {t("maturationMethods.parentalHeightsReported")} <span className="text-zinc-400">{t("maturationMethods.parentalHeightsReportedHintBulk")}</span>
            </span>
          </label>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2 text-zinc-700 hover:bg-gray-50">{t("datahub.cancel")}</button>
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-white hover:bg-accent/90">{t("datahub.savePlayer")}</button>
      </div>
    </>
  );
}

function HistoryRow({
  history,
}: {
  history: ReturnType<typeof useAppState>["assessments"];
}) {
  const { t } = useLocale();
  return (
    <tr>
      <td colSpan={13} className="border-t border-line/50 bg-white/55 px-5 py-5">
        <div className="rounded-[1.5rem] border border-line bg-white/80 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-900">{t("datahub.historyMeasurements")}</h3>
            <p className="text-xs text-ink-soft">{history.length} {t("datahub.measurementsRegistered")}</p>
          </div>
          <div className="table-scroll overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-ink-soft">
                <tr>
                  <th className="border-b border-line px-3 py-2">{t("datahub.date")}</th>
                  <th className="border-b border-line px-3 py-2">Stature</th>
                  <th className="border-b border-line px-3 py-2">Mass</th>
                  <th className="border-b border-line px-3 py-2">Sitting</th>
                  <th className="border-b border-line px-3 py-2">{t("datahub.group")}</th>
                  <th className="border-b border-line px-3 py-2">{t("datahub.offset")}</th>
                  <th className="border-b border-line px-3 py-2">% PAH</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.inputs.id} className="border-t border-line/50">
                    <td className="px-3 py-2">{formatDate(item.inputs.dataCollectionDate)}</td>
                    <td className="px-3 py-2">{formatNumber(item.inputs.statureCm, 1)} cm</td>
                    <td className="px-3 py-2">{formatNumber(item.inputs.bodyMassKg, 1)} kg</td>
                    <td className="px-3 py-2">{formatNumber(item.inputs.sittingHeightCm, 1)} cm</td>
                    <td className="px-3 py-2">{item.classification.maturityBand}</td>
                    <td className="px-3 py-2">{formatNumber(item.classification.primaryOffset, 2)}</td>
                    <td className="px-3 py-2">{formatNumber(item.methodOutputs.percentageAdultHeight, 2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </td>
    </tr>
  );
}