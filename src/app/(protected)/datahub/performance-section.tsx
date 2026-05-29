"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import * as XLSX from "xlsx";

import ExcelJS from "exceljs";
import {
  ClipboardList, Calendar, ChevronDown, ChevronRight,
  ChevronsUpDown, Download, Dumbbell, Edit2, FileSpreadsheet, MapPin, Plus, Search,
  Trash2, Trophy, UploadCloud, User, X, Beaker,
} from "lucide-react";
import { LabeledField } from "@/components/labeled-field";
import { FormErrorBanner } from "@/components/form-error-banner";
import { invalidInputClass } from "@/components/field-error";
import {
  clearFieldError,
  validatePerformanceEntry,
  validateTestDefinition,
  type FieldErrors,
} from "@/lib/form-errors";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useLocale } from "@/lib/i18n/locale-context";
import { useAppState } from "@/lib/store/app-state";
import type {
  PerformanceArea, PerformanceEntryInput, PerformanceEntry, PerformanceDefinition, TrainingLoadEntry,
} from "@/lib/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { performanceAreaLabels, emptyPerformanceForm, performancePresets } from "./performance-constants";
import {
  MultiSelectPill,
  PlayerAreaModal,
  SessionList,
  TestBatteryTab,
} from "./performance-section.parts";

// ─── Constants ────────────────────────────────────────────────────────────────
const AREA_ORDER: PerformanceArea[] = [
  "physical", "technicalTactical", "psychological", "motorSkills",
];

const AREA_COLOURS: Record<PerformanceArea, string> = {
  physical:          "bg-blue-50 text-blue-700 border-blue-200",
  technicalTactical: "bg-violet-50 text-violet-700 border-violet-200",
  psychological:     "bg-amber-50 text-amber-700 border-amber-200",
  motorSkills:       "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const AREA_HEADER_BG: Record<PerformanceArea, string> = {
  physical:          "bg-blue-50/60",
  technicalTactical: "bg-violet-50/60",
  psychological:     "bg-amber-50/60",
  motorSkills:       "bg-emerald-50/60",
};

// ─── Types ────────────────────────────────────────────────────────────────────
type GroupMode = "team" | "position";
type SortColumn = { testId: string; dir: "asc" | "desc" } | null;

// ─── Main component ───────────────────────────────────────────────────────────
export function PerformanceSection({
  area,
  setArea,
  performanceEntries,
  initialPanel = null,
  onPanelChange,
  canEditPerformance,
}: {
  area: PerformanceArea;
  setArea: (v: PerformanceArea) => void;
  performanceEntries: PerformanceEntry[];
  initialPanel?: { areaKey: PerformanceArea; athleteId: string } | null;
  onPanelChange?: (panel: { areaKey: PerformanceArea; athleteId: string } | null) => void;
  canEditPerformance?: boolean;
}) {
  const {
    addPerformanceEntry, updatePerformanceEntry, deletePerformanceEntry,
    addTrainingLoadEntry, importPerformanceEntries,
    addPerformanceDefinition, updatePerformanceDefinition, deletePerformanceDefinition,
    state
  } = useAppState();
  const { t, locale } = useLocale();
  const canEditTrainingLoad =
    state.currentUserRole === "admin" || state.currentUserPermissions.canEditTrainingLoad;

  const searchParams = useSearchParams();
  const viewParam = searchParams.get("view");
  
  // ── Tab: Batería de tests, Evaluaciones, Carga ─────────────────────────────
  const [perfTab, setPerfTab] = usePersistentState<"testBattery" | "tests" | "trainingLoad">(
    "datahub_perf_tab_v2",
    "testBattery"
  );
  const [trainingLoadSubTab, setTrainingLoadSubTab] = usePersistentState<"training" | "gps">(
    "datahub_training_load_sub_tab",
    "training"
  );

  // ── Test battery management states & handlers ─────────────────────────────
  const [testBatteryArea, setTestBatteryArea] = usePersistentState<PerformanceArea>("datahub_club_test_battery_area", "physical");
  const [showAddTestForm, setShowAddTestForm] = useState(false);
  const [testDefErrors, setTestDefErrors] = useState<FieldErrors>({});
  const [testDefSummary, setTestDefSummary] = useState("");
  const [newDef, setNewDef] = useState({ name: "", nameKey: undefined as string | undefined, descriptionKey: undefined as string | undefined, unit: "", attempts: 1, isRating: false, scoringStrategy: "best" as "best" | "average", interpretation: "higher_better" as "higher_better" | "lower_better", description: "", mediaUrl: "", mediaType: undefined as "image" | "video" | undefined, subCategory: undefined as string | undefined });

  function addDef(e: React.FormEvent) {
    e.preventDefault();
    const displayName = newDef.nameKey ? t(newDef.nameKey) : newDef.name;
    const result = validateTestDefinition(t, { name: displayName, unit: newDef.unit });
    if (!result.success) {
      setTestDefErrors(result.fieldErrors);
      setTestDefSummary(result.summary);
      return;
    }
    setTestDefErrors({});
    setTestDefSummary("");
    addPerformanceDefinition({
      name: result.data.name,
      nameKey: newDef.nameKey,
      area: testBatteryArea,
      unit: result.data.unit,
      attempts: newDef.attempts,
      isRating: newDef.isRating,
      scoringStrategy: newDef.scoringStrategy,
      interpretation: newDef.interpretation,
      description: newDef.description || undefined,
      descriptionKey: newDef.descriptionKey,
      mediaUrl: newDef.mediaUrl || undefined,
      mediaType: newDef.mediaType,
    });
    setNewDef({ name: "", nameKey: undefined, descriptionKey: undefined, unit: "", attempts: 1, isRating: false, scoringStrategy: "best", interpretation: "higher_better", description: "", mediaUrl: "", mediaType: undefined, subCategory: undefined });
    setShowAddTestForm(false);
  }

  function delDef(id: string) {
    deletePerformanceDefinition(id);
  }

  function handleMedia(e: React.ChangeEvent<HTMLInputElement>, type: "image" | "video") {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = (ev) => { setNewDef(c => ({ ...c, mediaUrl: ev.target?.result as string, mediaType: type })); };
    r.readAsDataURL(f);
  }

  const areaTestDefs = state.performanceDefinitions.filter(d => d.area === testBatteryArea);

  // Sync tab with URL parameter (only if explicitly set in deep link, otherwise keep persisted tab!)
  useEffect(() => {
    const v = searchParams.get("view");
    if (v === "testBattery") {
      setPerfTab("testBattery");
    } else if (v === "tests") {
      setPerfTab("tests");
    } else if (v === "trainingLoad") {
      setPerfTab("trainingLoad");
      setTrainingLoadSubTab("training");
    } else if (v === "gps") {
      setPerfTab("trainingLoad");
      setTrainingLoadSubTab("gps");
    }
  }, [searchParams, setPerfTab, setTrainingLoadSubTab]);

  // ── Add-result modal ───────────────────────────────────────────────────────
  const [showAddModal, setShowAddModal] = useState(false);

  // ── Players-view state ─────────────────────────────────────────────────────
  const [playerSearch,  setPlayerSearch]  = useState("");
  const [filterTeams,   setFilterTeams]   = useState<string[]>([]);   // multi-select
  const [filterPositions, setFilterPositions] = useState<string[]>([]); // multi-select
  const [groupByTeam,   setGroupByTeam]   = useState(false);
  const [groupByPos,    setGroupByPos]    = useState(false);
  const [sortBy,        setSortBy]        = useState<"name" | "age">("name");
  const [sortCol,       setSortCol]       = useState<SortColumn>(null); // column sort
  // panel = { areaKey, athleteId } when a row is clicked — restored from URL on mount
  const [selectedPanel, setSelectedPanel]  = useState<{ areaKey: PerformanceArea; athleteId: string } | null>(initialPanel ?? null);

  useEffect(() => {
    setSelectedPanel(initialPanel);
  }, [initialPanel]);

  // Helper to update panel state and notify parent (for URL sync)
  function handleSetSelectedPanel(panel: { areaKey: PerformanceArea; athleteId: string } | null) {
    setSelectedPanel(panel);
    onPanelChange?.(panel);
  }

  // Keep track of the initial mount phase to prevent usePersistentState lazy-load state updates from triggering fake transitions.
  const isMountedRef = useRef(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      isMountedRef.current = true;
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Clear panel selections and reset local search, filters, grouping, and ordering only when transitioning between sub-sub-tabs inside Performance.
  // This does not clear on initial load/refresh because prev variables start as null and we verify isMountedRef.
  const prevPerfTabRef = useRef<string | null>(null);
  useEffect(() => {
    const currentTab = perfTab;
    const prevTab = prevPerfTabRef.current;
    if (isMountedRef.current && prevTab !== null && prevTab !== currentTab) {
      setSelectedPanel(null);
      onPanelChange?.(null);

      // Reset persistent sub-selections within each tab
      setTestBatteryArea("physical");
      setTrainingLoadSubTab("training");

      // Reset all local search, filters, groupings, and orderings of the Performance tab
      setPlayerSearch("");
      setFilterTeams([]);
      setFilterPositions([]);
      setGroupByTeam(false);
      setGroupByPos(false);
      setSortBy("name");
      setSortCol(null);
    }
    prevPerfTabRef.current = currentTab;
  }, [perfTab, onPanelChange]);

  // ── Add-result form ────────────────────────────────────────────────────────
  const [perfForm,      setPerfForm]      = useState<PerformanceEntryInput>({ ...emptyPerformanceForm, area });
  const [perfFeedback,  setPerfFeedback]  = useState("");
  const [perfFieldErrors, setPerfFieldErrors] = useState<FieldErrors>({});
  const [perfFormSummary, setPerfFormSummary] = useState("");
  const [athleteSearch, setAthleteSearch] = useState("");
  const [showAthList,   setShowAthList]   = useState(false);
  const [attempts,      setAttempts]      = useState<number[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // ── Training load ──────────────────────────────────────────────────────────
  // Training load — new bulk entry panel
  const [tlType,        setTlType]        = useState<"training" | "match">("training");
  const [tlMinutes,     setTlMinutes]     = useState(60);
  const [tlTeamId,      setTlTeamId]      = useState("");  // will be set to first team
  const [tlNotes,       setTlNotes]       = useState("");
  const [tlRpeMap,      setTlRpeMap]      = useState<Record<string, number>>({});  // athleteId → rpe
  const [tlAttendedMap, setTlAttendedMap] = useState<Record<string, boolean>>({});
  const [tlShowPanel,   setTlShowPanel]   = useState(false);
  const [tlUseRpe,      setTlUseRpe]      = useState(true);
  const [tlMinutesMap,  setTlMinutesMap]  = useState<Record<string, number>>({});
  // Keep legacy single-athlete state for compat
  const [tlAthlete,  setTlAthlete]  = useState("");
  const [tlDate,     setTlDate]     = useState(new Date().toISOString().split("T")[0]);
  const [tlAttended, setTlAttended] = useState(true);
  const [tlRpe,      setTlRpe]      = useState(5);

  // ── Calendar ───────────────────────────────────────────────────────────────
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // ── Outside-click for athlete dropdown ────────────────────────────────────
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setShowAthList(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // ── Derived: form ──────────────────────────────────────────────────────────
  const testDefs = state.performanceDefinitions.filter(d => d.area === area);
  const selDef   = testDefs.find(d => d.name === perfForm.testName);
  const searchedAthletes = state.athletes.filter(a =>
    a.name.toLowerCase().includes(athleteSearch.toLowerCase())
  );
  const ratings = [
    { v: "Bronce", l: "Bronce" }, { v: "Plata",   l: "Plata"   },
    { v: "Oro",    l: "Oro"    }, { v: "Platino", l: "Platino" },
  ];

  useEffect(() => {
    if (!perfForm.testName && testDefs.length)
      setPerfForm(c => ({ ...c, testName: testDefs[0].name, unit: testDefs[0].unit }));
    if (selDef && selDef.attempts !== attempts.length)
      setAttempts(new Array(selDef.attempts).fill(0));
  }, [area, testDefs, perfForm.testName, selDef, attempts.length]);

  // ── Derived: table data ────────────────────────────────────────────────────
  const latestMap = useMemo(() => {
    const m = new Map<string, PerformanceEntry>();
    for (const e of performanceEntries) {
      const k = `${e.athleteId ?? e.athleteName}::${e.testName}`;
      const cur = m.get(k);
      if (!cur || e.measurementDate > cur.measurementDate) m.set(k, e);
    }
    return m;
  }, [performanceEntries]);

  const testsByArea = useMemo(() => {
    const out = {} as Record<PerformanceArea, PerformanceDefinition[]>;
    for (const a of AREA_ORDER)
      out[a] = state.performanceDefinitions.filter(d => d.area === a);
    return out;
  }, [state.performanceDefinitions]);

  const allTeams     = useMemo(() =>
    Array.from(new Set(state.athletes.map(a => a.teamName).filter(Boolean))).sort() as string[],
    [state.athletes]
  );
  const allPositions = useMemo(() =>
    Array.from(new Set(state.athletes.map(a => a.position).filter(Boolean))).sort() as string[],
    [state.athletes]
  );

  // Helper: latest entry for a given athlete + test name
  const resultFor = (athleteId: string, athleteName: string, testName: string) =>
    latestMap.get(`${athleteId}::${testName}`) ??
    latestMap.get(`${athleteName}::${testName}`);

  // Filter + base sort
  const filteredPlayers = useMemo(() => {
    let list = state.athletes.filter(a => {
      const ms = !playerSearch || a.name.toLowerCase().includes(playerSearch.toLowerCase());
      const mt = filterTeams.length === 0 || filterTeams.includes(a.teamName ?? "");
      const mp = filterPositions.length === 0 || filterPositions.includes(a.position ?? "");
      return ms && mt && mp;
    });

    // Base sort (name / age) – column sort overrides below
    if (!sortCol) {
      list = list.sort((a, b) =>
        sortBy === "age"
          ? (a.dob ?? "").localeCompare(b.dob ?? "")
          : a.name.localeCompare(b.name)
      );
    } else {
      // Sort by column test value
      list = [...list].sort((a, b) => {
        // find definition to know if lower is better
        const def = state.performanceDefinitions.find(d => d.id === sortCol.testId);
        const ea  = resultFor(a.id, a.name, def?.name ?? "");
        const eb  = resultFor(b.id, b.name, def?.name ?? "");
        const va  = ea?.value ?? null;
        const vb  = eb?.value ?? null;
        // nulls go to end
        if (va === null && vb === null) return 0;
        if (va === null) return 1;
        if (vb === null) return -1;
        const diff = va - vb;
        return sortCol.dir === "asc" ? diff : -diff;
      });
    }
    return list;
  }, [state.athletes, playerSearch, filterTeams, filterPositions, sortBy, sortCol, latestMap]);

  // Group
  const groupedPlayers = useMemo(() => {
    if (!groupByTeam && !groupByPos)
      return [{ label: null as string | null, players: filteredPlayers }];
    const m = new Map<string, typeof filteredPlayers>();
    for (const a of filteredPlayers) {
      const parts: string[] = [];
      if (groupByTeam) parts.push(a.teamName ?? t("datahub.noTeam"));
      if (groupByPos)  parts.push(a.position ?? t("datahub.noTeam"));
      const k = parts.join(" · ");
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(a);
    }
    return Array.from(m.entries())
      .sort(([ka], [kb]) => ka.localeCompare(kb))
      .map(([label, players]) => ({ label, players }));
  }, [groupByTeam, groupByPos, filteredPlayers, t]);

  const hasActiveFilters = playerSearch || filterTeams.length > 0 || filterPositions.length > 0;
  const areasWithTests   = AREA_ORDER.filter(a => testsByArea[a]?.length > 0);

  // Toggle column sort
  function toggleColSort(defId: string) {
    setSortCol(prev => {
      if (!prev || prev.testId !== defId) return { testId: defId, dir: "asc" };
      if (prev.dir === "asc") return { testId: defId, dir: "desc" };
      return null; // third click clears
    });
  }

  // ── Calendar helpers ───────────────────────────────────────────────────────
  const calYear  = calendarDate.getFullYear();
  const calMonth = calendarDate.getMonth();
  const startDay = (() => { const d = new Date(calYear, calMonth, 1).getDay(); return d === 0 ? 6 : d - 1; })();
  const daysInMo = new Date(calYear, calMonth + 1, 0).getDate();
  const { trainingLoadEntries } = state;
  const entriesForDate   = (date: string) => trainingLoadEntries.filter(e => e.date === date);
  const totalLoadForDate = (date: string) => entriesForDate(date).reduce((s, e) => s + e.load, 0);
  const loadColor        = (load: number) =>
    load === 0 ? "bg-white" :
    load < 200 ? "bg-green-100 border-green-300" :
    load < 400 ? "bg-yellow-100 border-yellow-300" :
    load < 600 ? "bg-orange-100 border-orange-300" :
                 "bg-red-100 border-red-300";
  const tlLoad     = tlAttended ? tlMinutes * tlRpe : 0;
  const isMatch     = tlType === "match";
  const selectedTeam = state.teams.find(tm => tm.id === tlTeamId);
  const teamAthletes = tlTeamId
    ? state.athletes.filter(a => a.teamId === tlTeamId || a.teamName === selectedTeam?.name)
    : [];
  const monthNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const dayNames   = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

  // ── Excel helpers ──────────────────────────────────────────────────────────
  async function downloadTemplate() {
    const wb = new ExcelJS.Workbook();
    wb.creator = "MaturationApp";

    const teams      = state.teams;
    const allAthletes = state.athletes;
    const isEN       = locale === "en";

    // ── Locale labels ─────────────────────────────────────────────────────────
    const AREA_LABELS: Record<PerformanceArea, string> = {
      physical:          isEN ? "Physical"           : "Físico",
      technicalTactical: isEN ? "Technical-Tactical" : "Técnico-Táctico",
      psychological:     isEN ? "Psychological"      : "Psicológico",
      motorSkills:       isEN ? "Motor Skills"       : "Motricidad",
    };
    const AREA_FILL: Record<PerformanceArea, string> = {
      physical: "DBEAFE", technicalTactical: "EDE9FE",
      psychological: "FEF3C7", motorSkills: "D1FAE5",
    };
    const COL = {
      team:    isEN ? "Team"              : "Equipo",
      player:  isEN ? "Player"            : "Jugador",
      test:    isEN ? "Test"              : "Test",
      date:    isEN ? "Date (YYYY-MM-DD)" : "Fecha (YYYY-MM-DD)",
      notes:   isEN ? "Notes"             : "Notas",
      value:   isEN ? "Value"             : "Valor",
      attempt: isEN ? "Attempt"           : "Intento",
    };

    // Build lookup: teamName → player names[]
    const teamPlayerMap = new Map<string, string[]>();
    teams.forEach(team => {
      const players = allAthletes
        .filter(a => a.teamId === team.id || a.teamName === team.name)
        .map(a => a.name);
      teamPlayerMap.set(team.name, players);
    });
    const teamNames = teams.map(t => t.name);

    // Inline list formula (max 255 chars for Excel data validation)
    function listFormula(items: string[]): string {
      // Excel data validation list: items separated by comma, wrapped in quotes
      const joined = items.map(s => s.replace(/"/g, "")).join(",");
      // Truncate if over 255 chars (Excel limit for inline lists)
      if (joined.length > 250) {
        let truncated = "";
        for (const item of items) {
          const next = truncated ? truncated + "," + item : item;
          if (next.length > 250) break;
          truncated = next;
        }
        return `"${truncated}"`;
      }
      return `"${joined}"`;
    }

    // ── Sheet 1: Instructions ─────────────────────────────────────────────────
    const instrTitle = isEN ? "Instructions" : "Instrucciones";
    const instrSheet = wb.addWorksheet(instrTitle);
    instrSheet.properties.tabColor = { argb: "FF1D4ED8" };

    // Title
    instrSheet.mergeCells("A1:G1");
    const titleCell = instrSheet.getCell("A1");
    titleCell.value = isEN
      ? "📋  HOW TO FILL IN THIS FILE"
      : "📋  CÓMO RELLENAR ESTE ARCHIVO";
    titleCell.font      = { bold: true, size: 14, color: { argb: "FF1F2937" } };
    titleCell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    titleCell.alignment = { vertical: "middle", horizontal: "center" };
    instrSheet.getRow(1).height = 36;
    instrSheet.addRow([]);

    const steps = isEN ? [
      ["1.", "Open the sheet for the area you want (e.g. 'Physical')."],
      ["2.", "Column A – select the Team from the dropdown."],
      ["3.", "Column B – select the Player from the dropdown."],
      ["4.", "Column C – select the Test from the dropdown. See the test table below to know which value columns to fill in."],
      ["5.", "Column D – enter the date in YYYY-MM-DD format (e.g. 2026-04-25)."],
      ["6.", "Column E – optional notes."],
      ["7.", "For tests with 1 value: fill the 'Value' column."],
      ["8.", "For tests with multiple attempts: fill 'Attempt 1', 'Attempt 2', etc. The app calculates the final score automatically."],
    ] : [
      ["1.", "Abre la pestaña del área que quieras rellenar (ej. 'Físico')."],
      ["2.", "Columna A – selecciona el Equipo en el desplegable."],
      ["3.", "Columna B – selecciona el Jugador en el desplegable."],
      ["4.", "Columna C – selecciona el Test en el desplegable. Consulta la tabla de tests de abajo para saber qué columnas rellenar."],
      ["5.", "Columna D – introduce la fecha en formato AAAA-MM-DD (ej. 2026-04-25)."],
      ["6.", "Columna E – notas opcionales."],
      ["7.", "Para tests de 1 valor: rellena la columna 'Valor'."],
      ["8.", "Para tests con varios intentos: rellena 'Intento 1', 'Intento 2', etc. La app calcula el resultado final automáticamente."],
    ];

    steps.forEach(([num, text]) => {
      const r = instrSheet.addRow([num, text]);
      r.height = 20;
      r.getCell(1).font = { bold: true, size: 10, color: { argb: "FF4B5563" } };
      r.getCell(2).font = { size: 10, color: { argb: "FF374151" } };
      instrSheet.mergeCells(r.number, 2, r.number, 7);
    });

    instrSheet.addRow([]);

    // Test guide table
    const ghHeaders = isEN
      ? ["Test", "Area", "Unit", "Attempts", "Scoring", "Fill column(s)"]
      : ["Test", "Área", "Unidad", "Intentos", "Criterio", "Rellenar columna(s)"];

    const ghRow = instrSheet.addRow(ghHeaders);
    ghRow.height = 22;
    ghRow.eachCell(cell => {
      cell.font  = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
      cell.alignment = { vertical: "middle", horizontal: "center" };
      cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } }, right: { style: "thin", color: { argb: "FFE5E7EB" } } };
    });

    let guideIdx = 0;
    for (const ak of AREA_ORDER) {
      const defs = (state.performanceDefinitions ?? []).filter(d => d.area === ak);
      for (const d of defs) {
        const n = d.attempts ?? 1;
        let scoring = "";
        let fillCols = "";
        if (n === 1) {
          scoring  = isEN ? "Single value"       : "Valor único";
          fillCols = isEN ? "'Value'"             : "'Valor'";
        } else if (d.scoringStrategy === "average") {
          scoring  = isEN ? `Average of ${n}`    : `Media de ${n}`;
          fillCols = isEN
            ? Array.from({length:n},(_,i)=>`'Attempt ${i+1}'`).join(", ")
            : Array.from({length:n},(_,i)=>`'Intento ${i+1}'`).join(", ");
        } else if (d.interpretation === "lower_better") {
          scoring  = isEN ? `Best (min) of ${n}` : `Mejor (mín) de ${n}`;
          fillCols = isEN
            ? Array.from({length:n},(_,i)=>`'Attempt ${i+1}'`).join(", ")
            : Array.from({length:n},(_,i)=>`'Intento ${i+1}'`).join(", ");
        } else {
          scoring  = isEN ? `Best (max) of ${n}` : `Mejor (máx) de ${n}`;
          fillCols = isEN
            ? Array.from({length:n},(_,i)=>`'Attempt ${i+1}'`).join(", ")
            : Array.from({length:n},(_,i)=>`'Intento ${i+1}'`).join(", ");
        }
        const bgFill = AREA_FILL[ak];
        const gr = instrSheet.addRow([(d.nameKey ? t(d.nameKey) : null) || d.name, AREA_LABELS[ak], d.unit, n, scoring, fillCols]);
        gr.height = 18;
        gr.eachCell((cell, ci) => {
          cell.font      = { size: 9, color: { argb: "FF374151" } };
          cell.alignment = { vertical: "middle", horizontal: ci === 1 ? "center" : "left" };
          cell.border    = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } }, right: { style: "hair", color: { argb: "FFE5E7EB" } } };
          cell.fill      = guideIdx % 2 === 0
            ? { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } }
            : { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        });
        gr.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + bgFill } };
        guideIdx++;
      }
    }

    instrSheet.getColumn(1).width = 28; instrSheet.getColumn(2).width = 18;
    instrSheet.getColumn(3).width = 10; instrSheet.getColumn(4).width = 10;
    instrSheet.getColumn(5).width = 22; instrSheet.getColumn(6).width = 40;

    // ── One data sheet per area ───────────────────────────────────────────────
    for (const areaKey of AREA_ORDER) {
      const defs = (state.performanceDefinitions ?? []).filter(d => d.area === areaKey);
      if (defs.length === 0) continue;

      const ws   = wb.addWorksheet(AREA_LABELS[areaKey]);
      const fill = AREA_FILL[areaKey];
      ws.properties.tabColor = { argb: "FF" + fill };

      const headerFill: ExcelJS.Fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + fill } };
      const headerFont: Partial<ExcelJS.Font> = { bold: true, size: 10, color: { argb: "FF374151" } };
      const border: Partial<ExcelJS.Borders>  = {
        bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
        right:  { style: "thin", color: { argb: "FFD1D5DB" } },
      };

      const maxAttempts = Math.max(...defs.map(d => d.attempts ?? 1));
      const hasSingle   = defs.some(d => (d.attempts ?? 1) === 1);
      const hasMulti    = defs.some(d => (d.attempts ?? 1) > 1);

      const extraHeaders: string[] = [];
      if (hasSingle) extraHeaders.push(COL.value);
      if (hasMulti)  for (let i = 1; i <= maxAttempts; i++) extraHeaders.push(`${COL.attempt} ${i}`);

      const allHeaders = [COL.team, COL.player, COL.test, COL.date, COL.notes, ...extraHeaders];
      const totalCols  = allHeaders.length;

      const headerRow = ws.addRow(allHeaders);
      headerRow.height = 24;
      headerRow.eachCell(cell => {
        cell.fill = headerFill; cell.font = headerFont; cell.border = border;
        cell.alignment = { vertical: "middle", horizontal: "center" };
      });

      ws.getColumn(1).width = 20; ws.getColumn(2).width = 22; ws.getColumn(3).width = 32;
      ws.getColumn(4).width = 18; ws.getColumn(5).width = 20;
      for (let i = 6; i <= totalCols; i++) ws.getColumn(i).width = 13;
      ws.views = [{ state: "frozen", ySplit: 1 }];

      // Test options — translated names (instructions sheet explains the columns)
      const testOptions = defs.map(d => (d.nameKey ? t(d.nameKey) : null) || d.name);

      // Inline list formulas (will always work, no cross-sheet refs)
      const teamFormula = listFormula(teamNames);
      const testFormula = listFormula(testOptions);

      for (let r = 2; r <= 201; r++) {
        const row = ws.addRow([]); row.height = 18;

        // Team — inline list
        row.getCell(1).dataValidation = {
          type: "list", allowBlank: true,
          formulae: [teamFormula],
          showErrorMessage: false,
        };
        row.getCell(1).alignment = { vertical: "middle" };

        // Player — inline list of ALL players (INDIRECT cross-sheet doesn't work reliably)
        const allPlayerNames = allAthletes.map(a => a.name);
        row.getCell(2).dataValidation = {
          type: "list", allowBlank: true,
          formulae: [listFormula(allPlayerNames)],
          showErrorMessage: false,
        };
        row.getCell(2).alignment = { vertical: "middle" };

        // Test — inline list
        row.getCell(3).dataValidation = {
          type: "list", allowBlank: true,
          formulae: [testFormula],
          showErrorMessage: false,
        };
        row.getCell(3).alignment = { vertical: "middle" };

        row.getCell(4).numFmt = "yyyy-mm-dd";
        row.getCell(4).alignment = { vertical: "middle", horizontal: "center" };

        if (r % 2 === 0) {
          for (let ci = 1; ci <= totalCols; ci++) {
            row.getCell(ci).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
          }
        }
      }
    }

    // ── Download ──────────────────────────────────────────────────────────────
    const buf  = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "performance-template.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const wb   = XLSX.read(await file.arrayBuffer(), { type: "array" });

    const AREA_SHEET_NAMES: Record<string, PerformanceArea> = {
      "Físico":              "physical",
      "Fisico":              "physical",
      "Physical":            "physical",
      "Técnico-Táctico":     "technicalTactical",
      "Tecnico-Tactico":     "technicalTactical",
      "Technical-Tactical":  "technicalTactical",
      "Psicológico":         "psychological",
      "Psicologico":         "psychological",
      "Psychological":       "psychological",
      "Motricidad":          "motorSkills",
      "Motor Skills":        "motorSkills",
    };

    const allImported: PerformanceEntryInput[] = [];

    for (const sheetName of wb.SheetNames) {
      if (sheetName.startsWith("_")) continue; // skip config
      if (sheetName === "Instructions" || sheetName === "Instrucciones") continue;
      const areaKey = AREA_SHEET_NAMES[sheetName] ?? "physical";
      // range:1 skips the guide row (row 1) so row 2 becomes the header
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { range: 1 });

      for (const row of rows) {
        const athleteName     = String(row["Jugador"] ?? row["Player"] ?? row["Name"] ?? "").trim();
        const testName        = String(row["Test"] ?? row["Test Name"] ?? "").trim();
        const rawDate         = row["Fecha (YYYY-MM-DD)"] ?? row["Date (YYYY-MM-DD)"] ?? row["Measurement Date"] ?? "";
        const measurementDate = formatExcelDate(rawDate);
        const teamName        = String(row["Equipo"] ?? row["Team"] ?? "").trim();
        const notes           = String(row["Notas"] ?? row["Notes"] ?? "").trim() || undefined;
        if (!athleteName || !testName || !measurementDate) continue;

        // Find test definition to know attempts + unit + scoring
        const def = state.performanceDefinitions.find(d => d.name === testName && d.area === areaKey);
        const numAttempts = def?.attempts ?? 1;

        if (numAttempts === 1) {
          const value = parseFloat(String(row["Valor"] ?? row["Value"] ?? "0"));
          if (!isFinite(value)) continue;
          allImported.push({ athleteName, testName, measurementDate, teamName, notes, area: areaKey, unit: def?.unit ?? "", value });
        } else {
          // Multiple attempts — try both ES and EN column names
          const nums: number[] = [];
          for (let i = 1; i <= numAttempts; i++) {
            const v = parseFloat(String(row[`Intento ${i}`] ?? row[`Attempt ${i}`] ?? ""));
            if (isFinite(v)) nums.push(v);
          }
          if (nums.length === 0) continue;
          let value = 0;
          if (def?.scoringStrategy === "average") {
            value = nums.reduce((a, b) => a + b, 0) / nums.length;
          } else if (def?.interpretation === "lower_better") {
            value = Math.min(...nums);
          } else {
            value = Math.max(...nums);
          }
          allImported.push({ athleteName, testName, measurementDate, teamName, notes, area: areaKey, unit: def?.unit ?? "", value, attemptCount: nums.length });
        }
      }
    }

    if (allImported.length > 0) {
      importPerformanceEntries(allImported);
      setPerfFeedback(`imported:${allImported.length}`);
    } else {
      setPerfFeedback("duplicate");
    }
    e.target.value = "";
  }

  function formatExcelDate(raw: unknown): string {
    if (!raw) return "";
    // If Excel serial number
    if (typeof raw === "number") {
      const d = new Date(Math.round((raw - 25569) * 86400 * 1000));
      return d.toISOString().split("T")[0];
    }
    const s = String(raw).trim();
    // Already ISO
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    // DD/MM/YYYY
    const dmy = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
    return s;
  }

  function sv<K extends keyof PerformanceEntryInput>(k: K, v: PerformanceEntryInput[K]) {
    setPerfForm(c => ({ ...c, [k]: v }));
  }

  function savePerf(e: React.FormEvent) {
    e.preventDefault();
    const athleteName = (perfForm.athleteName || athleteSearch).trim();
    const payload: PerformanceEntryInput = {
      ...perfForm,
      area,
      athleteName,
    };
    const result = validatePerformanceEntry(t, payload, { isRating: Boolean(selDef?.isRating) });
    if (!result.success) {
      setPerfFieldErrors(result.fieldErrors);
      setPerfFormSummary(result.summary);
      setPerfFeedback("validation");
      return;
    }

    const ath = state.athletes.find(
      (a) => a.id === perfForm.athleteId || a.name.toLowerCase() === athleteName.toLowerCase(),
    );
    const data = selDef?.isRating ? payload : { ...payload, ratingLevel: undefined, ratingValue: undefined };
    const added = addPerformanceEntry({
      ...data,
      teamName: perfForm.teamName || ath?.teamName,
      position: perfForm.position || ath?.position,
    });
    if (!added) {
      setPerfFieldErrors({ athleteName: t("datahub.validations.issue.athleteNotFound") });
      setPerfFormSummary("");
      setPerfFeedback("validation");
      return;
    }

    setPerfFieldErrors({});
    setPerfFormSummary("");
    setPerfFeedback("saved");
    setPerfForm({ ...emptyPerformanceForm, area });
    setAthleteSearch("");
    setTimeout(() => {
      setPerfFeedback("");
      setShowAddModal(false);
    }, 1500);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── Tab bar: 3 main tabs ─────────────────────────────────────────── */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: "testBattery",  icon: <Beaker className="h-4 w-4" />,      label: t("club.testBattery") || "Batería de Tests" },
          { id: "tests",        icon: <ClipboardList className="h-4 w-4" />, label: t("perfTab.tests") || "Evaluaciones" },
          { id: "trainingLoad", icon: <Calendar className="h-4 w-4" />,    label: t("perfTab.trainingLoad") },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setPerfTab(tab.id as typeof perfTab)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition",
              perfTab === tab.id
                ? "bg-accent text-white"
                : "bg-white border border-line text-zinc-600 hover:bg-zinc-50"
            )}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {/* ════════════════════ TEST BATTERY TAB ═════════════════════ */}
      {perfTab === "testBattery" && (
        <TestBatteryTab
          testBatteryArea={testBatteryArea}
          setTestBatteryArea={setTestBatteryArea}
          showAddTestForm={showAddTestForm}
          setShowAddTestForm={setShowAddTestForm}
          newDef={newDef}
          setNewDef={setNewDef}
          areaTestDefs={areaTestDefs}
          addDef={addDef}
          delDef={delDef}
          handleMedia={handleMedia}
          testDefErrors={testDefErrors}
          testDefSummary={testDefSummary}
          clearTestDefErrors={() => { setTestDefErrors({}); setTestDefSummary(""); }}
          setTestDefErrors={setTestDefErrors}
          updatePerformanceDefinition={updatePerformanceDefinition}
          t={t}
        />
      )}

      {/* ════════════════════ TESTS / EVALUACIONES TAB ═════════════════════ */}
      {perfTab === "tests" && (
        <section className="panel rounded-[1.75rem] p-6 overflow-visible space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{t("datahub.playersListTitle")}</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Últimos resultados por jugador, separados por área de rendimiento.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setPerfForm({ ...emptyPerformanceForm, area });
                setAthleteSearch("");
                setPerfFeedback("");
                setPerfFieldErrors({});
                setPerfFormSummary("");
                setShowAddModal(true);
              }}
              disabled={!canEditPerformance}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              {t("datahub.addResult") || "Añadir resultado"}
            </button>
          </div>

          {/* ── Toolbar ── */}
          <div className="flex flex-wrap gap-2 items-center">
            {/* Group */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium text-zinc-600">{t("datahub.groupLabel")}:</span>
              <button
                type="button"
                onClick={() => setGroupByTeam(v => !v)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  groupByTeam ? "bg-accent text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
              >
                {t("datahub.groupByTeam")}
              </button>
              <button
                type="button"
                onClick={() => setGroupByPos(v => !v)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-sm font-medium transition",
                  groupByPos ? "bg-accent text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
              >
                {t("datahub.groupByPlayer") === "Agrupar por jugador" ? "Posición" : "Position"}
              </button>
            </div>
            <span className="text-zinc-300 shrink-0">|</span>

            {/* Sort */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium text-zinc-600">{t("datahub.sortLabel")}:</span>
              <select
                value={sortBy}
                onChange={e => { setSortBy(e.target.value as "name" | "age"); setSortCol(null); }}
                className="rounded-full border border-line bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 outline-none cursor-pointer"
              >
                <option value="name">{t("datahub.sortByName")}</option>
                <option value="age">{t("datahub.sortByAge")}</option>
              </select>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-wrap gap-3 items-start">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder={t("datahub.searchPlayerPlaceholder")}
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                className="w-full rounded-full border border-line bg-white/70 pl-9 pr-4 py-2 text-sm outline-none focus:border-accent/50"
              />
            </div>

            {/* Multi-select: Teams */}
            <MultiSelectPill
              label={filterTeams.length === 0 ? t("datahub.allTeams") : filterTeams.join(", ")}
              options={allTeams}
              selected={filterTeams}
              onToggle={v => setFilterTeams(prev =>
                prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
              )}
              onClear={() => setFilterTeams([])}
            />

            {/* Multi-select: Positions */}
            <MultiSelectPill
              label={filterPositions.length === 0 ? t("datahub.position") : filterPositions.join(", ")}
              options={allPositions}
              selected={filterPositions}
              onToggle={v => setFilterPositions(prev =>
                prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]
              )}
              onClear={() => setFilterPositions([])}
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => {
                  setPlayerSearch("");
                  setFilterTeams([]);
                  setFilterPositions([]);
                }}
                className="rounded-full border border-line px-3 py-2 text-zinc-600 hover:bg-zinc-50 flex items-center justify-center transition"
                title={locale === 'es' ? 'Reiniciar Filtros' : 'Reset Filters'}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* ── Table ── */}
          {filteredPlayers.length === 0 ? (
            <p className="text-sm text-zinc-500 py-6 text-center">
              {hasActiveFilters ? t("datahub.noMatches") : t("club.noPlayers")}
            </p>
          ) : (
            <div className="space-y-6">
              {areasWithTests.map(areaKey => {
                const defs = testsByArea[areaKey] ?? [];
                if (defs.length === 0) return null;
                const colCount = 1 + defs.length;
                return (
                  <div key={areaKey}>
                    {/* Area title */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className={cn("inline-block rounded-full border px-3 py-1 text-xs font-bold", AREA_COLOURS[areaKey])}>
                        {t(performanceAreaLabels[areaKey])}
                      </span>
                      <div className="h-px flex-1 bg-zinc-100" />
                    </div>

                    <div className={cn("overflow-x-auto rounded-2xl border border-line bg-white/40", AREA_HEADER_BG[areaKey])}>
                      <table className="w-full min-w-max text-left text-sm">
                        <thead>
                          <tr className="text-zinc-500">
                            <th className={cn("border-b border-line px-3 py-3 text-center min-w-[180px]", AREA_HEADER_BG[areaKey])}>
                              <span className="text-[11px] font-medium text-zinc-500 whitespace-nowrap">
                                {t("datahub.player") || "Jugador"}
                              </span>
                            </th>
                            {defs.map(def => {
                              const isActive = sortCol?.testId === def.id;
                              return (
                                <th
                                  key={def.id}
                                  className={cn("border-b border-line px-3 py-3 text-[11px] font-medium whitespace-nowrap", AREA_HEADER_BG[areaKey])}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleColSort(def.id)}
                                    className="flex items-center gap-1 hover:text-zinc-900 transition group"
                                  >
                                    <span>{(def.nameKey ? t(def.nameKey) : null) || def.name}</span>
                                    <span className="text-zinc-400 ml-0.5">({def.unit})</span>
                                    <span className={cn(
                                      "ml-1 flex flex-col leading-none transition",
                                      isActive ? "text-accent" : "text-zinc-300 group-hover:text-zinc-400"
                                    )}>
                                      {isActive && sortCol?.dir === "asc"  && <span className="text-[9px]">▲</span>}
                                      {isActive && sortCol?.dir === "desc" && <span className="text-[9px]">▼</span>}
                                      {!isActive && <ChevronsUpDown className="h-3 w-3" />}
                                    </span>
                                  </button>
                                </th>
                              );
                            })}
                          </tr>
                        </thead>

                        <tbody suppressHydrationWarning>
                          {groupedPlayers.map(({ label, players }) => (
                            <Fragment key={label ?? "__all__"}>
                              {label && (
                                <tr>
                                  <td colSpan={colCount} className="px-3 pt-4 pb-1">
                                    <div className="flex items-center gap-2">
                                      <div className="h-1.5 w-1.5 rounded-full bg-accent" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</span>
                                      <div className="h-px flex-1 bg-zinc-100" />
                                    </div>
                                  </td>
                                </tr>
                              )}

                              {players.map(athlete => {
                                const isSelected = selectedPanel?.areaKey === areaKey && selectedPanel?.athleteId === athlete.id;
                                return (
                                  <Fragment key={athlete.id}>
                                    <tr
                                      onClick={() => handleSetSelectedPanel({ areaKey, athleteId: athlete.id })}
                                      className={cn(
                                        "border-t border-line/50 hover:bg-white/60 transition cursor-pointer",
                                        isSelected && "bg-accent/5"
                                      )}
                                    >
                                      {/* Player cell */}
                                      <td className="px-3 py-3 min-w-[180px]">
                                        <div className="flex items-center gap-2.5">
                                          <div className="h-8 w-8 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center overflow-hidden shrink-0">
                                            {(athlete as { photoUrl?: string }).photoUrl ? (
                                              <img src={(athlete as { photoUrl?: string }).photoUrl} alt="" className="h-full w-full object-cover" />
                                            ) : (
                                              <User className="h-4 w-4 text-zinc-400" />
                                            )}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="font-semibold text-zinc-900 truncate leading-tight">{athlete.name}</p>
                                            <p className="text-[10px] text-zinc-400 font-medium truncate">
                                              {athlete.teamName ?? "—"} · {athlete.position ?? "—"}
                                            </p>
                                          </div>
                                          <ChevronRight className="h-3.5 w-3.5 text-zinc-300 ml-auto shrink-0" />
                                        </div>
                                      </td>

                                      {/* Result cells — only this area's tests */}
                                      {defs.map(def => {
                                        const entry = resultFor(athlete.id, athlete.name, def.name);
                                        if (!entry) {
                                          return <td key={def.id} className="px-3 py-3 text-zinc-300 text-center text-xs">—</td>;
                                        }
                                        const display = entry.ratingLevel ? entry.ratingLevel : formatNumber(entry.value, 2);
                                        const isColSorted = sortCol?.testId === def.id;
                                        return (
                                          <td key={def.id} className={cn("px-3 py-3", isColSorted && "bg-accent/5")}>
                                            <div className="flex flex-col gap-0.5" suppressHydrationWarning>
                                              <span className="font-semibold text-zinc-900" suppressHydrationWarning>{display}</span>
                                              <span className="text-[10px] text-zinc-400" suppressHydrationWarning>{formatDate(entry.measurementDate)}</span>
                                            </div>
                                          </td>
                                        );
                                      })}
                                    </tr>


                                  </Fragment>
                                );
                              })}
                            </Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ══════════════════════ PLAYER AREA DETAIL MODAL ══════════════════════ */}
      {selectedPanel && (() => {
        const athlete = state.athletes.find(a => a.id === selectedPanel.athleteId);
        if (!athlete) return null;
        const areaKey = selectedPanel.areaKey;
        const defs    = testsByArea[areaKey] ?? [];
        return (
          <PlayerAreaModal
            athlete={athlete}
            areaKey={areaKey}
            defs={defs}
            performanceEntries={performanceEntries}
            updatePerformanceEntry={updatePerformanceEntry}
            deletePerformanceEntry={deletePerformanceEntry}
            onClose={() => handleSetSelectedPanel(null)}
            onAddResult={() => {
              sv("athleteName", athlete.name);
              sv("teamName",    athlete.teamName ?? "");
              sv("position",    athlete.position ?? "");
              setAthleteSearch(athlete.name);
              handleSetSelectedPanel(null);
              setShowAddModal(true);
            }}
            t={t}
            canEditPerformance={canEditPerformance}
          />
        );
      })()}


      {/* ══════════════════════ TRAINING LOAD TAB ══════════════════════ */}
      {perfTab === "trainingLoad" && (
        <section className="panel rounded-[1.75rem] p-6 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { id: "training" as const, label: t("trainingLoad.training") },
              { id: "gps" as const, label: t("gps.title") },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTrainingLoadSubTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition",
                  trainingLoadSubTab === tab.id
                    ? "bg-accent text-white"
                    : "bg-white border border-line text-zinc-600 hover:bg-zinc-50"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {trainingLoadSubTab === "training" ? (
            <div className="space-y-6">
              {/* ── Month nav ── */}
              <div className="flex items-center justify-between">
                <button onClick={() => setCalendarDate(new Date(calYear, calMonth - 1, 1))}
                  className="rounded-xl border border-line bg-white/70 px-4 py-2 text-sm text-zinc-700 hover:bg-white transition">
                  ←
                </button>
                <h2 className="text-lg font-semibold text-zinc-900">{monthNames[calMonth]} {calYear}</h2>
                <button onClick={() => setCalendarDate(new Date(calYear, calMonth + 1, 1))}
                  className="rounded-xl border border-line bg-white/70 px-4 py-2 text-sm text-zinc-700 hover:bg-white transition">
                  →
                </button>
              </div>

          {/* ── Calendar grid ── */}
          <div className="rounded-2xl border border-line bg-white/50 overflow-hidden">
            <div className="grid grid-cols-7 bg-zinc-50 border-b border-line">
              {dayNames.map(d => (
                <div key={d} className="py-2.5 text-center text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {Array.from({ length: startDay }).map((_, i) => (
                <div key={`e${i}`} className="min-h-20 border-b border-r border-line/30 bg-zinc-50/50" />
              ))}
              {Array.from({ length: daysInMo }).map((_, di) => {
                const day = di + 1;
                const ds  = `${calYear}-${String(calMonth + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                const ens = entriesForDate(ds);
                const tl  = totalLoadForDate(ds);
                const isSel   = selectedDate === ds;
                const isToday = ds === new Date().toISOString().split("T")[0];
                return (
                  <div
                    key={ds}
                    onClick={() => {
                      if (isSel) { setSelectedDate(null); setTlShowPanel(false); }
                      else { setSelectedDate(ds); setTlDate(ds); setTlShowPanel(false); }
                    }}
                    className={cn(
                      "min-h-20 border-b border-r border-line/30 p-1.5 cursor-pointer transition hover:bg-white/80 select-none",
                      loadColor(tl),
                      isSel && "ring-2 ring-accent ring-inset",
                      isToday && "bg-accent/5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <span className={cn("text-sm font-semibold leading-none", isToday ? "text-accent" : "text-zinc-700")}>{day}</span>
                      {tl > 0 && <span className="text-[10px] font-bold text-zinc-500">{tl}</span>}
                    </div>
                    <div className="mt-1 flex flex-col gap-0.5">
                      {/* One badge per unique (sessionType + team) */}
                      {(() => {
                        // group entries by sessionType+teamId to get distinct sessions
                        const seen = new Map<string, { type: "training"|"match"; teamName: string }>();
                        ens.forEach(e => {
                          const ath = state.athletes.find(a => a.id === e.athleteId);
                          const teamName = ath?.teamName ?? "";
                          const key = `${e.sessionType}::${teamName}`;
                          if (!seen.has(key)) seen.set(key, { type: e.sessionType as "training"|"match", teamName });
                        });
                        return Array.from(seen.values()).map(({ type, teamName }) => (
                          <div key={`${type}::${teamName}`}
                            className={cn("flex items-center gap-0.5 rounded-full px-1.5 py-0.5 w-fit",
                              type === "match" ? "bg-purple-50" : "bg-blue-50")}>
                            {type === "match"
                              ? <Trophy className={cn("h-2.5 w-2.5 shrink-0 text-purple-500")} />
                              : <Dumbbell className={cn("h-2.5 w-2.5 shrink-0 text-blue-500")} />}
                            {teamName && (
                              <span className={cn("text-[8px] font-semibold truncate max-w-[52px]",
                                type === "match" ? "text-purple-600" : "text-blue-600")}>
                                {teamName}
                              </span>
                            )}
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Selected date panel ── */}
          {selectedDate && (
            <div className="rounded-2xl border border-line bg-white/70 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-zinc-900">{formatDate(selectedDate)}</h3>
                <button
                  type="button"
                  onClick={() => setTlShowPanel((v) => !v)}
                  disabled={!canEditTrainingLoad}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                    canEditTrainingLoad
                      ? "bg-accent text-white hover:bg-accent/90"
                      : "border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed",
                  )}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {locale === "en" ? "Add session" : "Añadir sesión"}
                </button>
              </div>

              {/* Existing entries for selected date */}
              {entriesForDate(selectedDate).length > 0 && (
                <SessionList
                  entries={entriesForDate(selectedDate)}
                  athletes={state.athletes}
                  locale={locale}
                  allEntries={trainingLoadEntries}
                />
              )}

              {/* Add session inline panel */}
              {tlShowPanel && (
                <div className="rounded-2xl border-2 border-accent/30 bg-accent/5 p-4 space-y-4">

                    {/* ── Config row ── */}
                    <div className="flex flex-wrap gap-3 items-end">
                      {/* Type */}
                      <div className="grid gap-1">
                        <label className="text-xs font-medium text-zinc-600">{locale === "en" ? "Type" : "Tipo"}</label>
                        <div className="flex gap-2">
                          {(["training", "match"] as const).map(st => (
                            <button key={st} type="button"
                              onClick={() => { setTlType(st); if (st === "match") setTlUseRpe(false); else setTlUseRpe(true); }}
                              className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition",
                                tlType === st ? "bg-accent text-white" : "bg-white border border-line text-zinc-600 hover:bg-zinc-50")}>
                              {st === "training" ? (locale === "en" ? "Training" : "Manual") : (locale === "en" ? "Match" : "Partido")}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Team — mandatory */}
                      <div className="grid gap-1">
                        <label className="text-xs font-medium text-zinc-600">{locale === "en" ? "Team" : "Equipo"}</label>
                        <select value={tlTeamId}
                          onChange={e => setTlTeamId(e.target.value)}
                          className={cn("rounded-xl border bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none",
                            !tlTeamId ? "border-red-300" : "border-line")}>
                          <option value="">{locale === "en" ? "— select —" : "— selecciona —"}</option>
                          {state.teams.map(tm => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
                        </select>
                      </div>

                      {/* Global minutes */}
                      <div className="grid gap-1">
                        <label className="text-xs font-medium text-zinc-600">{locale === "en" ? "Minutes (default)" : "Minutos (defecto)"}</label>
                        <input type="number" min={0} max={300} value={tlMinutes}
                          onChange={e => setTlMinutes(Number(e.target.value) || 0)}
                          className="w-24 rounded-xl border border-line bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-accent/50" />
                      </div>

                      {/* RPE toggle — hidden for match (auto 10) */}
                      {!isMatch && (
                        <div className="grid gap-1">
                          <label className="text-xs font-medium text-zinc-600">RPE</label>
                          <button type="button"
                            onClick={() => setTlUseRpe((v) => !v)}
                            className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                              tlUseRpe ? "bg-accent/10 border-accent/30 text-accent" : "bg-white border-line text-zinc-400")}>
                            <span className={cn("w-7 h-4 rounded-full transition flex items-center px-0.5",
                              tlUseRpe ? "bg-accent" : "bg-zinc-200")}>
                              <span className={cn("w-3 h-3 rounded-full bg-white shadow-sm transition-transform",
                                tlUseRpe ? "translate-x-3" : "translate-x-0")} />
                            </span>
                            {tlUseRpe ? (locale === "en" ? "On" : "Activo") : (locale === "en" ? "Off" : "Sin RPE")}
                          </button>
                        </div>
                      )}
                      {isMatch && (
                        <div className="grid gap-1">
                          <label className="text-xs font-medium text-zinc-600">RPE</label>
                          <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-600">Auto 10</span>
                        </div>
                      )}

                      {/* Notes */}
                      <div className="grid gap-1 flex-1 min-w-32">
                        <label className="text-xs font-medium text-zinc-600">{locale === "en" ? "Notes" : "Notas"}</label>
                        <input type="text" value={tlNotes} onChange={e => setTlNotes(e.target.value)}
                          placeholder={locale === "en" ? "Optional..." : "Opcional..."}
                          className="rounded-xl border border-line bg-white px-3 py-1.5 text-sm text-zinc-700 outline-none focus:border-accent/50" />
                      </div>
                    </div>

                    {/* ── Player list ── */}
                    {!tlTeamId ? (
                      <p className="text-sm text-zinc-500 text-center py-2">
                        {locale === "en" ? "Select a team first." : "Selecciona un equipo primero."}
                      </p>
                    ) : teamAthletes.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center py-2">
                        {locale === "en" ? "No players in this team." : "No hay jugadores en este equipo."}
                      </p>
                    ) : (
                      <>
                        {/* Column headers */}
                        <div className="grid items-center gap-x-2 text-[10px] font-semibold text-zinc-400 uppercase tracking-wide mb-1"
                          style={{ gridTemplateColumns: "160px 40px 60px 1fr" }}>
                          <span>{locale === "en" ? "Player" : "Jugador"}</span>
                          <span className="text-center">{locale === "en" ? "In" : "Asiste"}</span>
                          <span className="text-center">min</span>
                          {(tlUseRpe || isMatch) && <span>RPE</span>}
                        </div>

                        <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                          {teamAthletes.map(ath => {
                            const attended = tlAttendedMap[ath.id] !== false;
                            const rpe      = isMatch ? 10 : (tlRpeMap[ath.id] ?? 6);
                            const mins     = tlMinutesMap[ath.id] ?? tlMinutes;
                            return (
                              <div key={ath.id}
                                className="grid items-center gap-x-2"
                                style={{ gridTemplateColumns: "160px 40px 60px 1fr" }}>

                                {/* Name */}
                                <span className={cn("text-sm font-medium truncate",
                                  attended ? "text-zinc-800" : "text-zinc-400 line-through")}>
                                  {ath.name}
                                </span>

                                {/* Attended toggle */}
                                <div className="flex justify-center">
                                  <button type="button"
                                    onClick={() => setTlAttendedMap(m => ({ ...m, [ath.id]: !attended }))}
                                    className={cn("rounded-full w-8 h-5 transition flex items-center px-0.5",
                                      attended ? "bg-accent" : "bg-zinc-200")}>
                                    <span className={cn("w-4 h-4 rounded-full bg-white shadow-sm transition-transform",
                                      attended ? "translate-x-3" : "translate-x-0")} />
                                  </button>
                                </div>

                                {/* Per-player minutes override */}
                                <input type="number" min={0} max={300}
                                  value={mins}
                                  disabled={!attended}
                                  onChange={e => setTlMinutesMap((m: Record<string, number>) => ({ ...m, [ath.id]: Number(e.target.value) || 0 }))}
                                  className={cn("w-full rounded-lg border px-2 py-1 text-xs text-center outline-none focus:border-accent/50",
                                    !attended ? "bg-zinc-50 border-zinc-100 text-zinc-300" : "border-line bg-white text-zinc-700",
                                    (tlMinutesMap[ath.id] !== undefined && tlMinutesMap[ath.id] !== tlMinutes) && attended && "border-amber-300 bg-amber-50"
                                  )}
                                />

                                {/* RPE */}
                                {attended && (tlUseRpe || isMatch) && (
                                  isMatch ? (
                                    <span className="text-xs font-bold text-red-500">10</span>
                                  ) : (
                                    <div className="flex gap-0.5">
                                      {[1,2,3,4,5,6,7,8,9,10].map(v => (
                                        <button key={v} type="button"
                                          onClick={() => setTlRpeMap(m => ({ ...m, [ath.id]: v }))}
                                          className={cn(
                                            "w-6 h-6 rounded-md text-[10px] font-bold transition",
                                            rpe === v
                                              ? v <= 3 ? "bg-green-500 text-white"
                                              : v <= 6 ? "bg-yellow-400 text-white"
                                              : v <= 8 ? "bg-orange-500 text-white"
                                              : "bg-red-500 text-white"
                                              : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200"
                                          )}>
                                          {v}
                                        </button>
                                      ))}
                                    </div>
                                  )
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Save / Cancel */}
                        {(!tlTeamId || !selectedDate) && (
                          <p className="text-xs text-red-600 pt-1">
                            {t("datahub.validations.issue.trainingLoadPrereq")}
                          </p>
                        )}
                        <div className="flex gap-3 pt-2">
                          <button type="button"
                            disabled={!tlTeamId || !selectedDate || !canEditTrainingLoad}
                            onClick={() => {
                              if (!selectedDate || !canEditTrainingLoad) return;
                              teamAthletes.forEach(ath => {
                                const attended = tlAttendedMap[ath.id] !== false;
                                const rpe      = isMatch ? 10 : (tlUseRpe ? (tlRpeMap[ath.id] ?? 6) : 1);  // 1 = neutral, never 0 (breaks load calc)
                                const mins     = tlMinutesMap[ath.id] ?? tlMinutes;
                                addTrainingLoadEntry({
                                  athleteId:    ath.id,
                                  date:         selectedDate,
                                  attended,
                                  sessionType:  tlType,
                                  minutesPlayed: attended ? mins : 0,
                                  rpe:          attended ? rpe : 0,
                                  notes:        tlNotes || undefined,
                                });
                              });
                              setTlShowPanel(false);
                              setTlRpeMap({});
                              setTlAttendedMap({});
                              setTlMinutesMap({});
                              setTlNotes("");
                            }}
                            className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent/90 transition disabled:opacity-40"
                          >
                            <Plus className="h-4 w-4" />
                            {locale === "en" ? "Save session" : "Guardar sesión"}
                          </button>
                          <button type="button"
                            onClick={() => { setTlShowPanel(false); setTlRpeMap({}); setTlAttendedMap({}); setTlMinutesMap({}); setTlNotes(""); }}
                            className="rounded-2xl border border-line px-4 py-2.5 text-sm text-zinc-600 hover:bg-zinc-50 transition">
                            {t("datahub.cancel") || "Cancelar"}
                          </button>
                        </div>
                        {!canEditTrainingLoad && (
                          <p className="text-sm text-red-600 pt-2">
                            {t("datahub.trainingLoadNoPermission") ||
                              "No tienes permiso para editar registros de carga de entrenamiento."}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                )}
            </div>
          )}
        </div>
      ) : (
            <section className="rounded-2xl border border-line bg-white/50 p-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <MapPin className="h-6 w-6 text-zinc-400" />
                <h2 className="text-xl font-semibold">{t("gps.title")}</h2>
              </div>
              <p className="text-lg font-medium text-zinc-700 mb-2">{t("gps.comingSoon")}</p>
              <p className="text-sm text-zinc-500 max-w-md mx-auto">{t("gps.body")}</p>
            </section>
          )}
        </section>
      )}

      {/* ══════════════════════ ADD RESULT MODAL ══════════════════════ */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAddModal(false)}
          onKeyDown={e => e.key === "Escape" && setShowAddModal(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">{t("datahub.addResult") || "Añadir resultado"}</h3>
                <p className="text-sm text-zinc-500 mt-0.5">{t("datahub.registerResultsBody")}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 transition shrink-0 ml-4"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Area selector */}
            <div className="grid gap-2 grid-cols-2 md:grid-cols-4 mb-6">
              {(Object.keys(performanceAreaLabels) as PerformanceArea[]).map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => { setArea(item); sv("area", item); }}
                  className={cn(
                    "rounded-xl border-2 px-3 py-2.5 text-left transition-all",
                    area === item
                      ? "border-accent bg-accent text-white shadow-sm"
                      : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                  )}
                >
                  <p className="text-xs font-semibold">{t(performanceAreaLabels[item])}</p>
                </button>
              ))}
            </div>

            {/* Excel import row */}
            <div
              onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).classList.add("border-emerald-500", "bg-emerald-50"); }}
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).classList.remove("border-emerald-500", "bg-emerald-50"); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                (e.currentTarget as HTMLElement).classList.remove("border-emerald-500", "bg-emerald-50");
                const files = e.dataTransfer.files;
                if (files && files.length > 0) {
                  const file = files[0];
                  if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
                    const mockEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
                    importFile(mockEvent);
                  }
                }
              }}
              className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-5 p-6 rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 transition-colors"
            >
              <button
                type="button"
                onClick={downloadTemplate}
                className="flex items-center gap-2 rounded-lg bg-white border border-line px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition shadow-sm"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                {t("datahub.excelTemplate")}
              </button>
              <label className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 cursor-pointer transition shadow-sm">
                <UploadCloud className="h-4 w-4" />
                {t("datahub.uploadExcel")}
                <input type="file" accept=".xlsx,.xls" className="hidden" onChange={importFile} />
              </label>
            </div>

            {testDefs.length === 0 ? (
              <div className="rounded-xl border border-line bg-zinc-50 p-8 text-center">
                <p className="text-zinc-600">{t("club.noTestsDefined")}</p>
              </div>
            ) : (
              <form className="grid gap-4 md:grid-cols-2" onSubmit={savePerf} noValidate>
                {perfFeedback === "validation" && (
                  <FormErrorBanner
                    summary={perfFormSummary}
                    fieldErrors={perfFieldErrors}
                    t={t}
                    className="md:col-span-2"
                  />
                )}
                {/* Athlete picker */}
                <LabeledField label={t("datahub.player")} className="md:col-span-2" error={perfFieldErrors.athleteName}>
                  <div className="relative" ref={dropdownRef}>
                    <input
                      type="text"
                      className={cn(
                        "w-full rounded-2xl border bg-white/70 px-4 py-3 text-zinc-700",
                        perfFieldErrors.athleteName ? invalidInputClass : "border-line",
                      )}
                      placeholder={t("datahub.searchOrTypeName")}
                      value={athleteSearch}
                      onChange={e => {
                        setAthleteSearch(e.target.value);
                        setShowAthList(true);
                        setPerfFieldErrors(prev => clearFieldError(prev, "athleteName"));
                      }}
                      onFocus={() => setShowAthList(true)}
                    />
                    {showAthList && athleteSearch.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 rounded-2xl border border-line bg-white shadow-lg z-50 max-h-48 overflow-y-auto">
                        {searchedAthletes.length > 0
                          ? searchedAthletes.map(a => (
                              <button key={a.id} type="button"
                                onClick={() => { sv("athleteName", a.name); setAthleteSearch(a.name); setShowAthList(false); }}
                                className="w-full px-4 py-2.5 text-left hover:bg-accent/10 border-b border-line/50 last:border-b-0 transition text-zinc-700">
                                <div className="font-medium text-sm">{a.name}</div>
                                {a.teamName && <div className="text-xs text-zinc-500">{a.teamName}</div>}
                              </button>
                            ))
                          : <div className="px-4 py-3 text-sm text-zinc-500">{t("datahub.noMatchingPlayers")}</div>
                        }
                      </div>
                    )}
                    {perfForm.athleteName && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 text-sm text-accent border border-accent/30">
                        {perfForm.athleteName}
                        <button
                          type="button"
                          onClick={() => { sv("athleteName", ""); sv("athleteId", undefined); setAthleteSearch(""); }}
                          className="ml-0.5 rounded-full hover:bg-accent/20 p-0.5 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </LabeledField>

                <LabeledField label={t("datahub.measurement")} error={perfFieldErrors.measurementDate}>
                  <input
                    type="date"
                    className={cn(
                      "rounded-2xl border bg-white/70 px-4 py-3 text-zinc-700 w-full",
                      perfFieldErrors.measurementDate ? invalidInputClass : "border-line",
                    )}
                    value={perfForm.measurementDate}
                    onChange={e => sv("measurementDate", e.target.value)}
                  />
                </LabeledField>

                <LabeledField label={t("datahub.test")} error={perfFieldErrors.testName}>
                  <select
                    className={cn(
                      "rounded-2xl border bg-white/70 px-4 py-3 text-zinc-700 w-full",
                      perfFieldErrors.testName ? invalidInputClass : "border-line",
                    )}
                    value={perfForm.testName}
                    onChange={e => {
                      const def = testDefs.find(d => d.name === e.target.value);
                      setPerfForm(c => ({ ...c, testName: e.target.value, unit: def?.unit ?? c.unit }));
                      setPerfFieldErrors(prev => clearFieldError(prev, "testName"));
                    }}
                  >
                    {testDefs.map(d => {
                      const label = (d.nameKey ? t(d.nameKey) : null) || d.name;
                      return <option key={d.id} value={d.name}>{label} ({d.unit})</option>;
                    })}
                  </select>
                </LabeledField>


                {selDef?.isRating ? (
                  <>
                    <LabeledField label={t("datahub.rating")} error={perfFieldErrors.ratingLevel}>
                      <div className="grid grid-cols-2 gap-2">
                        {ratings.map(r => (
                          <button key={r.v} type="button" onClick={() => { sv("ratingLevel", r.v); setPerfFieldErrors(prev => clearFieldError(prev, "ratingLevel")); }}
                            className={cn("rounded-2xl border px-4 py-3 text-sm font-medium transition",
                              perfForm.ratingLevel === r.v ? "border-accent bg-accent text-white" : "border-line bg-white/70 text-zinc-700 hover:bg-white")}>
                            {r.l}
                          </button>
                        ))}
                      </div>
                    </LabeledField>
                    <LabeledField label={t("datahub.numericValueOptional")}>
                      <input type="number" step="0.1" className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700"
                        placeholder={t("datahub.exampleRatingValue")} value={perfForm.ratingValue ?? ""}
                        onChange={e => sv("ratingValue", Number(e.target.value))} />
                    </LabeledField>
                  </>
                ) : selDef && selDef.attempts > 1 ? (
                  <LabeledField
                    label={`${t("datahub.valuesWithAttempts")} (${selDef.attempts} ${t("datahub.attemptsShort")} - ${selDef.scoringStrategy === "average" ? t("datahub.avgShort") : selDef.interpretation === "lower_better" ? t("datahub.bestMinShort") : t("datahub.bestMaxShort")})`}
                    className="md:col-span-2"
                  >
                    <div className="grid gap-2 md:grid-cols-2">
                      {Array.from({ length: selDef.attempts }, (_, i) => (
                        <input key={i} type="number" step="0.01"
                          className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700"
                          placeholder={`${t("datahub.attemptLabel")} ${i + 1}`}
                          value={String(attempts[i] ?? "")}
                          onChange={e => {
                            const nv = [...attempts]; nv[i] = Number(e.target.value) || 0; setAttempts(nv);
                            const vv = nv.filter(v => v > 0); let cv = 0;
                            if (vv.length > 0) {
                              cv = selDef.scoringStrategy === "average"
                                ? vv.reduce((a, b) => a + b, 0) / vv.length
                                : selDef.interpretation === "lower_better" ? Math.min(...vv) : Math.max(...vv);
                            }
                            sv("value", cv);
                          }}
                        />
                      ))}
                    </div>
                  </LabeledField>
                ) : (
                  <LabeledField label={t("datahub.value")} error={perfFieldErrors.value}>
                    <input
                      type="number"
                      step="0.01"
                      className={cn(
                        "rounded-2xl border bg-white/70 px-4 py-3 text-zinc-700 w-full",
                        perfFieldErrors.value ? invalidInputClass : "border-line",
                      )}
                      placeholder={t("datahub.exampleValue")}
                      value={perfForm.value || ""}
                      onChange={e => sv("value", Number(e.target.value))}
                    />
                  </LabeledField>
                )}

                <LabeledField label={t("common.notes")} className="md:col-span-2">
                  <input className="rounded-2xl border border-line bg-white/70 px-4 py-3 text-zinc-700"
                    placeholder={t("datahub.exampleNotes")} value={perfForm.notes ?? ""}
                    onChange={e => sv("notes", e.target.value)} />
                </LabeledField>

                <div className="md:col-span-2 flex gap-3">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-2xl border border-line bg-white px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
                    {t("datahub.cancel") || "Cancelar"}
                  </button>
                  <button type="submit"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-accent px-5 py-3 text-sm font-medium text-slate-950 hover:bg-accent-strong">
                    <Plus className="h-4 w-4" />{t("datahub.addResult") || "Añadir resultado"}
                  </button>
                </div>

                {perfFeedback && perfFeedback !== "validation" && (
                  <p className={cn(
                    "mt-2 rounded-2xl border px-4 py-3 text-sm md:col-span-2",
                    perfFeedback === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-line bg-white/70 text-zinc-700"
                  )}>
                    {perfFeedback === "saved" ? "✅ " + t("datahub.testAddedOk")
                     : perfFeedback === "duplicate" ? t("datahub.cannotImportRows")
                     : t("datahub.importedRows").replace("{count}", perfFeedback.split(":")[1] ?? "0")}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}