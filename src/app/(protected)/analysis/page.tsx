"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  Radar, RadarChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Scatter, ScatterChart, Legend,
} from "recharts";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Filter,
  Search, TrendingUp, Users, Calendar, MapPin, Target,
  Dumbbell, Shield, Activity, Group, Trophy, Zap, Download,
  ArrowLeft, ArrowRight, Info, X, ChartColumnBig, Home
} from "lucide-react";
import { buildInsights } from "@/lib/maturation/insights";
import { useAppState } from "@/lib/store/app-state";
import { useLocale } from "@/lib/i18n/locale-context";
import { formatDate, formatNumber } from "@/lib/utils";
import { MaturationInsights } from "@/components/maturation-insights";
import {
  buildTeamStats, computeAthleteZScore, buildBioBandingGroups,
  buildAlerts, detectRapidGrowth,
} from "@/lib/maturation/analysis-helpers";
import {
  getAssessmentsForBand,
  getAssessmentsForTeam,
  getLatestAssessmentsByAthlete,
  getUniqueAthleteTeams,
} from "@/lib/maturation/selectors";
import type { MaturityBand, TrainingLoadEntry, PerformanceEntry, MaturationResult } from "@/lib/types";
import type { TeamStats, AlertItem, RapidGrowthAlert } from "@/lib/maturation/analysis-helpers";

const bandColors: Record<string, string> = {
  "Pre-PHV": "#0f766e",
  "Mid-PHV": "#b45309",
  "Post-PHV": "#0f172a",
};

type AnalysisTab = "individual" | "collective" | "assistant";

// ---------------------------------------------------------------------------
// INDIVIDUAL TAB
// ---------------------------------------------------------------------------
function IndividualView({
  assessments,
  state,
  t,
  locale,
  onBack,
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
  locale: string;
  onBack: () => void;
}) {
  const teams = useMemo(
    () => getUniqueAthleteTeams(state.athletes),
    [state.athletes],
  );

  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterBand, setFilterBand] = useState("");
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [comparisonIds, setComparisonIds] = useState<string[]>([]);
  const [comparisonConfig, setComparisonConfig] = useState<{
    mode: 'team' | 'athletes' | 'external-team';
    externalTeam?: string;
  }>({ mode: 'team' });
  const [compSearch, setCompSearch] = useState("");
  const [compTeam, setCompTeam] = useState("");
  const [compPos, setCompPos] = useState("");
  const [showComparisonPanel, setShowComparisonPanel] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'maturation' | 'performance' | 'load'>('maturation');
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(true);

  // Auto-collapse selector when a primary player is picked
  useEffect(() => {
    if (selectedAthleteId && comparisonIds.length === 0) {
      setIsSelectorExpanded(false);
    }
  }, [selectedAthleteId]);

  const toggleComparison = (id: string) => {
    if (id === selectedAthleteId) return; // Can't compare with self as a separate entity
    setComparisonIds(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
  };

  const toggleTeam = (teamName: string) => {
    setExpandedTeams(prev => ({ ...prev, [teamName]: !prev[teamName] }));
  };

  // Hack to force Recharts to re-measure after animations/tab switches
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedAthleteId, activeSubTab]);

  const latestByAthlete = useMemo(
    () => getLatestAssessmentsByAthlete(assessments),
    [assessments],
  );

  const filtered = useMemo(() => {
    return latestByAthlete.filter((a) => {
      if (search && !a.inputs.athleteName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTeam && a.inputs.teamName !== filterTeam) return false;
      if (filterBand && a.classification.maturityBand !== filterBand) return false;
      return true;
    });
  }, [latestByAthlete, search, filterTeam, filterBand]);

  const selectedLatest = useMemo(
    () => latestByAthlete.find((a) => a.inputs.athleteId === selectedAthleteId),
    [latestByAthlete, selectedAthleteId]
  );

  const activeComparisonAthletes = useMemo(() => {
    if (!selectedLatest) return [];
    
    if (comparisonConfig.mode === 'team') {
      return latestByAthlete.filter(a => a.inputs.teamName === selectedLatest.inputs.teamName && a.inputs.athleteId !== selectedLatest.inputs.athleteId);
    }
    if (comparisonConfig.mode === 'external-team' && comparisonConfig.externalTeam) {
      return latestByAthlete.filter(a => a.inputs.teamName === comparisonConfig.externalTeam);
    }

    if (comparisonConfig.mode === 'athletes') {
      return latestByAthlete.filter(a => comparisonIds.includes(a.inputs.athleteId));
    }
    return [];
  }, [comparisonConfig, comparisonIds, latestByAthlete, selectedLatest, state.athletes]);

  const comparisonLatest = activeComparisonAthletes;

  const selectedHistory = useMemo(
    () =>
      assessments
        .filter((a) => a.inputs.athleteId === selectedAthleteId)
        .sort((a, b) => a.inputs.dataCollectionDate.localeCompare(b.inputs.dataCollectionDate)),
    [assessments, selectedAthleteId],
  );

  const comparisonHistories = useMemo(
    () => activeComparisonAthletes.map(a => ({
      id: a.inputs.athleteId,
      name: a.inputs.athleteName,
      history: assessments
        .filter(h => h.inputs.athleteId === a.inputs.athleteId)
        .sort((a, b) => a.inputs.dataCollectionDate.localeCompare(b.inputs.dataCollectionDate))
    })),
    [assessments, activeComparisonAthletes]
  );

  // Z-score and comparison data
  const teamAssessments = useMemo(
    () => selectedLatest ? getAssessmentsForTeam(latestByAthlete, selectedLatest.inputs.teamName) : [],
    [latestByAthlete, selectedLatest],
  );

  const teamMeanOffset = useMemo(() => {
    if (teamAssessments.length === 0) return 0;
    return teamAssessments.reduce((acc: number, a: MaturationResult) => acc + a.classification.primaryOffset, 0) / teamAssessments.length;
  }, [teamAssessments]);

  const currentBaseline = useMemo(() => {
    if (!selectedLatest) return { mean: 0, label: '', type: 'default' };

    if (comparisonConfig.mode === 'external-team' && comparisonConfig.externalTeam) {
      return {
        mean: activeComparisonAthletes.length > 0 
          ? activeComparisonAthletes.reduce((acc, a) => acc + a.classification.primaryOffset, 0) / activeComparisonAthletes.length
          : 0,
        label: locale === 'es' ? `Equipo: ${comparisonConfig.externalTeam}` : `Team: ${comparisonConfig.externalTeam}`,
        type: 'external'
      };
    }

    if (comparisonConfig.mode === 'athletes' && comparisonIds.length > 0) {
      const group = [selectedLatest, ...comparisonLatest].filter((a): a is MaturationResult => !!a);
      const mean = group.reduce((acc, a) => acc + a.classification.primaryOffset, 0) / Math.max(1, group.length);
      return { 
        mean, 
        label: locale === 'es' ? 'Jugadores seleccionados' : 'Selected athletes',
        type: 'comparison'
      };
    }
    return { 
      mean: teamMeanOffset, 
      label: locale === 'es' ? 'Media del Equipo' : 'Team Mean',
      type: 'default'
    };
  }, [comparisonConfig, comparisonIds, selectedLatest, comparisonLatest, teamMeanOffset, locale, state.athletes, activeComparisonAthletes]);

  const zScoreInfo = useMemo(() => {
    if (!selectedLatest) return null;
    
    // Determine the reference group for SD
    let referenceOffsets: number[] = [];
    if (comparisonConfig.mode === 'external-team' && comparisonConfig.externalTeam) {
      referenceOffsets = activeComparisonAthletes.map(a => a.classification.primaryOffset);
    } else if (comparisonConfig.mode === 'athletes' && comparisonIds.length > 0) {
      const group = [selectedLatest, ...comparisonLatest].filter((a): a is MaturationResult => !!a);
      referenceOffsets = group.map(a => a.classification.primaryOffset);
    } else {
      referenceOffsets = teamAssessments.map(a => a.classification.primaryOffset);
    }

    const baselineMean = currentBaseline.mean;
    const sd = referenceOffsets.length > 1 
      ? Math.sqrt(referenceOffsets.reduce((s, v) => s + (v - baselineMean) ** 2, 0) / referenceOffsets.length) 
      : 0.5;
    
    const zScore = sd === 0 ? 0 : (selectedLatest.classification.primaryOffset - baselineMean) / sd;
    
    return {
      score: zScore,
      label: currentBaseline.label
    };
  }, [selectedLatest, teamAssessments, currentBaseline, comparisonConfig, activeComparisonAthletes, comparisonLatest, comparisonIds]);

  const combinedHistory = useMemo(() => {
    if (!selectedLatest) return [];
    const dates = new Set<string>();
    selectedHistory.forEach(h => dates.add(h.inputs.dataCollectionDate));
    comparisonHistories.forEach(ch => {
      ch.history.forEach(h => dates.add(h.inputs.dataCollectionDate));
    });

    return Array.from(dates).sort().map(date => {
      const entry: any = { date: formatDate(date) };
      const primaryMatch = selectedHistory.find(h => h.inputs.dataCollectionDate === date);
      if (primaryMatch) {
        entry[selectedLatest.inputs.athleteName] = Number(primaryMatch.classification.primaryOffset.toFixed(2));
      }
      comparisonHistories.forEach(ch => {
        const match = ch.history.find(h => h.inputs.dataCollectionDate === date);
        if (match) {
          entry[ch.name] = Number(match.classification.primaryOffset.toFixed(2));
        }
      });
      return entry;
    });
  }, [selectedHistory, comparisonHistories, selectedLatest]);

  const athleteLoad = useMemo(() => {
    if (!selectedAthleteId) return [];
    return state.trainingLoadEntries
      .filter((l: TrainingLoadEntry) => l.athleteId === selectedAthleteId)
      .sort((a: TrainingLoadEntry, b: TrainingLoadEntry) => a.date.localeCompare(b.date));
  }, [state.trainingLoadEntries, selectedAthleteId]);

  const combinedLoadHistory = useMemo(() => {
    if (!selectedLatest) return [];
    const dates = new Set<string>();
    athleteLoad.forEach((l: TrainingLoadEntry) => dates.add(l.date));
    comparisonIds.forEach(id => {
      state.trainingLoadEntries
        .filter((l: TrainingLoadEntry) => l.athleteId === id)
        .forEach((l: TrainingLoadEntry) => dates.add(l.date));
    });

    return Array.from(dates).sort().map(date => {
      const entry: any = { date: formatDate(date) };
      const primaryMatch = athleteLoad.find((l: TrainingLoadEntry) => l.date === date);
      if (primaryMatch) {
        entry[selectedLatest.inputs.athleteName] = primaryMatch.load;
      }
      comparisonIds.forEach((id, i) => {
        const cMatch = state.trainingLoadEntries.find((l: TrainingLoadEntry) => l.athleteId === id && l.date === date);
        if (cMatch) {
          const name = latestByAthlete.find(a => a.inputs.athleteId === id)?.inputs.athleteName || id;
          entry[name] = cMatch.load;
        }
      });
      return entry;
    });
  }, [athleteLoad, comparisonIds, state.trainingLoadEntries, selectedLatest, latestByAthlete]);
  const athletePerformance = useMemo(() => {
    if (!selectedAthleteId) return [];
    const entries = state.performanceEntries.filter(e => e.athleteId === selectedAthleteId);
    const tests = state.performanceDefinitions;
    
    return tests.map(test => {
      const history = entries
        .filter((e: PerformanceEntry) => e.testName === test.name)
        .sort((a: any, b: any) => a.measurementDate.localeCompare(b.measurementDate))
        .map((e: PerformanceEntry) => ({ 
          value: e.value, 
          measurementDate: e.measurementDate, 
          unit: test.unit,
          area: test.area 
        }));
        
      if (history.length === 0) return null;
      return {
        testName: test.name,
        area: test.area,
        latest: history[history.length - 1],
        history
      };
    }).filter(Boolean) as { testName: string, area: string, latest: any, history: any[] }[];
  }, [state.performanceEntries, state.performanceDefinitions, selectedAthleteId]);

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors no-print"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{locale === "es" ? "Volver" : "Back"}</span>
      </button>

      {/* Athlete Selection Area */}
      <div className="space-y-4 no-print">
        {selectedLatest && !isSelectorExpanded ? (
          <div className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl shadow-sm animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-white shadow-inner ${
                selectedLatest.classification.maturityBand === "Pre-PHV" ? "bg-teal-500" :
                selectedLatest.classification.maturityBand === "Mid-PHV" ? "bg-amber-500" :
                "bg-slate-500"
              }`}>
                {selectedLatest.inputs.athleteName.charAt(0)}
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 truncate">
                  {selectedLatest.inputs.athleteName}
                </h3>
                <p className="text-xs text-slate-500">{selectedLatest.inputs.teamName} · {selectedLatest.classification.maturityBand}</p>
              </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center border-x border-slate-100 px-6 no-print text-center">
              <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${comparisonConfig.mode !== 'team' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                {locale === 'es' ? 'Comparando con:' : 'Comparing with:'} {currentBaseline.label}
              </div>
              <p className="text-[10px] text-slate-400 mt-1 italic max-w-xs">
                {locale === 'es' 
                  ? `Las métricas y Z-Score se calculan respecto a ${currentBaseline.label.toLowerCase()}`
                  : `Metrics and Z-Score are calculated against ${currentBaseline.label.toLowerCase()}`}
              </p>
            </div>

            <div className="flex items-center gap-2 no-print">
              <button 
                onClick={() => setShowComparisonPanel(!showComparisonPanel)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-bold transition-all shadow-sm ${
                  showComparisonPanel 
                    ? "bg-teal-600 border-teal-700 text-white" 
                    : "bg-white border-teal-200 text-teal-600 hover:bg-teal-50"
                }`}
              >
                <Activity className="h-4 w-4" />
                {locale === 'es' ? 'Comparar' : 'Compare'}
                <ChevronDown className={`h-4 w-4 transition-transform ${showComparisonPanel ? 'rotate-180' : ''}`} />
              </button>
              
              <div className="h-8 w-[1px] bg-slate-100 mx-1"></div>
              <button 
                onClick={handleExportPDF}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors"
              >
                <Download className="h-3 w-3" />
                PDF
              </button>
              <button
                onClick={() => setIsSelectorExpanded(true)}
                className="flex items-center gap-2 px-4 py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-bold hover:bg-teal-100 transition-colors"
              >
                <Users className="h-4 w-4" />
                <span className="hidden xs:inline">{locale === 'es' ? 'Cambiar Jugador' : 'Change Player'}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
            {/* Filters row */}
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">{t("analysis.individual.selectAthlete")}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 no-print">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder={t("analysis.individual.searchAthlete")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-400" />
                <select
                  value={filterTeam}
                  onChange={(e) => setFilterTeam(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{t("analysis.individual.allTeams")}</option>
                  {teams.map((team) => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
                <select
                  value={filterBand}
                  onChange={(e) => setFilterBand(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">{t("analysis.individual.allBands")}</option>
                  <option value="Pre-PHV">Pre-PHV</option>
                  <option value="Mid-PHV">Mid-PHV</option>
                  <option value="Post-PHV">Post-PHV</option>
                </select>
              </div>
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                {t("common.export")} PDF
              </button>
            </div>

            {/* Athlete selector - Grouped by Team */}
            <div className="space-y-2 no-print">
              {teams.map(teamName => {
                const teamAthletes = filtered.filter(a => a.inputs.teamName === teamName);
                if (teamAthletes.length === 0) return null;
                const isExpanded = expandedTeams[teamName];

                return (
                  <div key={teamName} className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <button
                      onClick={() => toggleTeam(teamName)}
                      className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-teal-50 rounded-lg">
                          <Users className="h-4 w-4 text-teal-600" />
                        </div>
                        <span className="font-bold text-slate-900">{teamName}</span>
                        <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                          {teamAthletes.length}
                        </span>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="p-2 bg-slate-50/50 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                        {teamAthletes.map((a) => (
                          <div
                            key={a.inputs.athleteId}
                            className={`flex items-center gap-2 p-2 rounded-xl border transition-all ${
                              selectedAthleteId === a.inputs.athleteId
                                ? "bg-teal-50 border-teal-200 ring-1 ring-teal-200"
                                : "bg-white border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <button
                              onClick={() => {
                                setSelectedAthleteId(a.inputs.athleteId);
                              }}
                              className="flex items-center gap-3 flex-1 min-w-0 text-left"
                            >
                              <div className={`h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-xs ${
                                a.classification.maturityBand === "Pre-PHV" ? "bg-teal-100 text-teal-700" :
                                a.classification.maturityBand === "Mid-PHV" ? "bg-amber-100 text-amber-700" :
                                "bg-slate-200 text-slate-700"
                              }`}>
                                {a.inputs.athleteName.charAt(0)}
                              </div>
                              <div className="min-w-0 text-xs">
                                <div className="font-semibold truncate">{a.inputs.athleteName}</div>
                              </div>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {selectedLatest && (
              <button
                onClick={() => setIsSelectorExpanded(false)}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors no-print"
              >
                {locale === 'es' ? '↑ Minimizar selector' : '↑ Minimize selector'}
              </button>
            )}
          </div>
        )}
      </div>

      {!selectedLatest ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <Users size={48} className="mb-4 opacity-20" />
          <p>{t("analysis.individual.noDataSelected")}</p>
        </div>
      ) : (
        /* Comparison Panel */
        <>
        {selectedLatest && showComparisonPanel && (
          <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-300 no-print">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{locale === 'es' ? 'Configurar Comparativa' : 'Configure Comparison'}</h3>
                <p className="text-sm text-slate-500">{locale === 'es' ? 'Elige contra qué grupo quieres medir el rendimiento del atleta.' : 'Choose the group you want to measure the athlete\'s performance against.'}</p>
              </div>
              <button 
                onClick={() => setShowComparisonPanel(false)}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-6 md:grid-cols-4">
              {/* Mode Selection */}
              <div className="md:col-span-1 space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{locale === 'es' ? 'Modo de Referencia' : 'Reference Mode'}</label>
                <div className="flex flex-col gap-1">
                  {[
                    { id: 'team', label: locale === 'es' ? 'Mismo Equipo' : 'Same Team', icon: Users },
                    { id: 'athletes', label: locale === 'es' ? 'Jugadores Libres' : 'Free Athletes', icon: Activity },
                    { id: 'external-team', label: locale === 'es' ? 'Otro Equipo' : 'Another Team', icon: Group },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setComparisonConfig(prev => ({ ...prev, mode: mode.id as any }))}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-bold transition-all ${
                        comparisonConfig.mode === mode.id 
                          ? "bg-teal-600 border-teal-700 text-white shadow-md shadow-teal-100" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <mode.icon className="h-4 w-4" />
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Contextual Options */}
              <div className="md:col-span-3 p-5 bg-white rounded-2xl border border-slate-200 shadow-inner min-h-[160px] flex flex-col justify-center">
                {comparisonConfig.mode === 'team' && (
                  <div className="text-center animate-in fade-in slide-in-from-bottom-2">
                    <Users className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="font-bold text-slate-800">{locale === 'es' ? 'Comparación con toda la plantilla' : 'Comparison with entire squad'}</p>
                    <p className="text-sm text-slate-500 mt-1">{locale === 'es' ? `Se utilizarán los ${teamAssessments.length} compañeros de ${selectedLatest.inputs.teamName} como base.` : `Using ${teamAssessments.length} teammates from ${selectedLatest.inputs.teamName} as baseline.`}</p>
                  </div>
                )}

                {comparisonConfig.mode === 'athletes' && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 h-full flex flex-col">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 h-3.5 w-3.5" />
                        <input
                          type="text"
                          placeholder={locale === 'es' ? 'Buscar jugador...' : 'Search player...'}
                          value={compSearch}
                          onChange={(e) => setCompSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-teal-500/20 outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <select
                          value={compTeam}
                          onChange={(e) => setCompTeam(e.target.value)}
                          className="text-[10px] p-1.5 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-600"
                        >
                          <option value="">{locale === 'es' ? 'Todos los equipos' : 'All teams'}</option>
                          {teams.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select
                          value={compPos}
                          onChange={(e) => setCompPos(e.target.value)}
                          className="text-[10px] p-1.5 bg-white border border-slate-200 rounded-lg outline-none font-bold text-slate-600"
                        >
                          <option value="">{locale === 'es' ? 'Todas las posiciones' : 'All positions'}</option>
                          {Array.from(new Set(state.athletes.map(a => a.position).filter(Boolean))).map(p => <option key={p} value={p!}>{p}</option>)}
                        </select>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-1 bg-amber-100 text-amber-700 rounded-lg whitespace-nowrap">{comparisonIds.length} {locale === 'es' ? 'seleccionados' : 'selected'}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 overflow-y-auto p-1 flex-1 min-h-0">
                      {latestByAthlete
                        .filter(a => a.inputs.athleteId !== selectedLatest.inputs.athleteId)
                        .filter(a => {
                          if (compSearch && !a.inputs.athleteName.toLowerCase().includes(compSearch.toLowerCase())) return false;
                          if (compTeam && a.inputs.teamName !== compTeam) return false;
                          if (compPos) {
                            const at = state.athletes.find(ath => ath.id === a.inputs.athleteId);
                            if (at?.position !== compPos) return false;
                          }
                          return true;
                        })
                        .map(a => (
                        <button
                          key={a.inputs.athleteId}
                          onClick={() => toggleComparison(a.inputs.athleteId)}
                          className={`flex items-center gap-2 p-2 rounded-lg border text-[10px] font-bold transition-all ${
                            comparisonIds.includes(a.inputs.athleteId)
                              ? "bg-amber-500 border-amber-600 text-white shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 shadow-sm"
                          }`}
                        >
                          <div className="h-4 w-4 rounded-full bg-black/10 flex items-center justify-center text-[8px]">{a.inputs.athleteName.charAt(0)}</div>
                          <span className="truncate">{a.inputs.athleteName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {comparisonConfig.mode === 'external-team' && (
                  <div className="text-center space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    <Group className="h-10 w-10 text-slate-300 mx-auto mb-1" />
                    <p className="font-bold text-slate-800">{locale === 'es' ? 'Comparar con otro equipo' : 'Compare with another team'}</p>
                    <div className="max-w-xs mx-auto">
                      <select 
                        value={comparisonConfig.externalTeam || ""}
                        onChange={(e) => setComparisonConfig(prev => ({ ...prev, externalTeam: e.target.value }))}
                        className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold focus:ring-2 focus:ring-teal-500 outline-none"
                      >
                        <option value="">-- {locale === 'es' ? 'Seleccionar Equipo' : 'Select Team'} --</option>
                        {teams.filter(t => t !== selectedLatest.inputs.teamName).map(t => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print:space-y-8">
          <div className="hidden print:block border-b pb-4 mb-4">
            <h1 className="text-2xl font-bold">{selectedLatest.inputs.athleteName} - {t("analysis.individual.reportTitle")}</h1>
            <p className="text-slate-500">{selectedLatest.inputs.teamName} · {formatDate(new Date().toISOString())}</p>
          </div>

          {/* Multi-Athlete Comparison Bar (only when comparison is active) */}
          {comparisonIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 p-4 bg-amber-50/50 border border-amber-100 rounded-2xl no-print">
              <div className="flex items-center gap-2 text-amber-700 font-bold text-xs uppercase tracking-wider">
                <Activity className="h-4 w-4" />
                {locale === 'es' ? 'Comparando con:' : 'Comparing with:'}
              </div>
              {comparisonLatest.map(a => (
                <div key={a.inputs.athleteId} className="flex items-center gap-2 bg-white border border-amber-200 px-3 py-1.5 rounded-xl shadow-sm animate-in zoom-in-95">
                   <div className={`h-6 w-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    a.classification.maturityBand === "Pre-PHV" ? "bg-teal-100 text-teal-700" :
                    a.classification.maturityBand === "Mid-PHV" ? "bg-amber-100 text-amber-700" :
                    "bg-slate-200 text-slate-700"
                  }`}>
                    {a.inputs.athleteName.charAt(0)}
                  </div>
                  <span className="text-sm font-bold text-slate-700">{a.inputs.athleteName}</span>
                  <button 
                    onClick={() => toggleComparison(a.inputs.athleteId)}
                    className="p-1 hover:bg-amber-100 text-amber-400 hover:text-amber-600 rounded-lg transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <button 
                onClick={() => setComparisonIds([])}
                className="text-xs font-bold text-amber-600 hover:text-amber-800 transition-colors ml-auto"
              >
                {locale === 'es' ? 'Limpiar todo' : 'Clear all'}
              </button>
            </div>
          )}

          {/* Sub-tabs Navigation */}
          <div className="flex border-b border-slate-200 no-print overflow-x-auto">
            {[
              { id: 'maturation', label: locale === 'es' ? 'Maduración' : 'Maturation', icon: <TrendingUp className="h-4 w-4" /> },
              { id: 'performance', label: locale === 'es' ? 'Rendimiento' : 'Performance', icon: <Trophy className="h-4 w-4" /> },
              { id: 'load', label: locale === 'es' ? 'Carga de entrenamiento' : 'Training Load', icon: <Dumbbell className="h-4 w-4" /> },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? "border-teal-600 text-teal-600 bg-teal-50/30"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
          
          <div key={activeSubTab} className="animate-in fade-in slide-in-from-bottom-2 duration-300">

          {activeSubTab === 'maturation' && (
            <div className="space-y-6">
              {/* Maturation Insights Cards */}
              <MaturationInsights 
                result={selectedLatest} 
                zScore={zScoreInfo ? { score: zScoreInfo.score, label: zScoreInfo.label } : undefined}
                baselineLabel={currentBaseline.label}
              />

              {/* Team Comparison */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-teal-600" />
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                      {t("analysis.individual.teamComparison")}
                    </h3>
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    {teamAssessments.length} {t("analysis.individual.teammates")}
                  </div>
                </div>
                
                <div className="h-56 w-full relative">
                  <ResponsiveContainer width="99.9%" height={224} minWidth={0} debounce={100}>
                    <BarChart data={teamAssessments.map(a => ({
                      name: a.inputs.athleteName,
                      offset: Number(a.classification.primaryOffset.toFixed(2)),
                      isSelf: a.inputs.athleteId === selectedAthleteId
                    }))}>
                      <XAxis dataKey="name" hide />
                      <YAxis />
                      <Tooltip formatter={(val: any) => [formatNumber(Number(val), 2), t("datahub.offset")]} />
                      <Bar dataKey="offset">
                        {teamAssessments.map((entry, index) => {
                          const isPrimary = entry.inputs.athleteId === selectedAthleteId;
                          const isComparison = comparisonIds.includes(entry.inputs.athleteId);
                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={isPrimary ? '#0d9488' : isComparison ? '#f59e0b' : '#e2e8f0'} 
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs pt-4 border-t border-slate-100">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-teal-600"></div>
                      <span className="font-medium text-slate-600">{selectedLatest.inputs.athleteName}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-slate-200"></div>
                      <span className="font-medium text-slate-400">{t("analysis.individual.teammates")}</span>
                    </div>
                  </div>
                  <div className="font-bold text-teal-600">
                    {t("analysis.individual.zScoreLabel")}: {zScoreInfo?.score.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Temporal Trend */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-teal-600" />
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                      {t("analysis.individual.temporalTrend")}
                    </h3>
                  </div>
                </div>
                <div className="h-64 w-full relative">
                  <ResponsiveContainer width="99.9%" height={256} minWidth={0} debounce={100}>
                    <LineChart data={combinedHistory}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                      <YAxis fontSize={10} axisLine={false} tickLine={false} label={{ value: t("datahub.offset"), angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
                      <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px' }} />
                      <Line 
                        type="monotone" 
                        dataKey={selectedLatest?.inputs.athleteName} 
                        stroke="#0d9488" 
                        strokeWidth={4} 
                        dot={{ r: 4, strokeWidth: 2, fill: '#fff' }} 
                        activeDot={{ r: 6, strokeWidth: 0 }}
                      />
                      {comparisonHistories.map((ch, i) => (
                        <Line 
                          key={ch.id}
                          type="monotone" 
                          dataKey={ch.name} 
                          stroke={['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'][i % 4]} 
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comparison Table (only when multiple athletes selected) */}
              {comparisonIds.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="font-bold text-slate-900 text-sm uppercase tracking-wider">{locale === 'es' ? 'Comparativa de Maduración' : 'Maturation Comparison'}</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 font-medium">
                          <th className="px-6 py-4">{t("analysis.individual.athleteName")}</th>
                          <th className="px-6 py-4">{t("datahub.offset")}</th>
                          <th className="px-6 py-4">PHV Status</th>
                          <th className="px-6 py-4">Moore APHV</th>
                          <th className="px-6 py-4">PAH (cm)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[selectedLatest, ...comparisonLatest].filter(Boolean).map((a: any) => (
                          <tr key={a.inputs.athleteId} className={a.inputs.athleteId === selectedAthleteId ? "bg-teal-50/30" : ""}>
                            <td className="px-6 py-4 font-bold">{a.inputs.athleteName}</td>
                            <td className="px-6 py-4 font-bold text-teal-600">{formatNumber(a.classification.primaryOffset, 2)}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                a.classification.maturityBand === "Pre-PHV" ? "bg-teal-100 text-teal-700" :
                                a.classification.maturityBand === "Mid-PHV" ? "bg-amber-100 text-amber-700" :
                                "bg-slate-200 text-slate-700"
                              }`}>
                                {a.classification.maturityBand}
                              </span>
                            </td>
                            <td className="px-6 py-4">{formatNumber(a.methodOutputs.mooreAphv, 2)}</td>
                            <td className="px-6 py-4">{a.methodOutputs.pahCm ? `${formatNumber(a.methodOutputs.pahCm, 2)} cm` : "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Report Table */}
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900">{t("analysis.individual.reportTitle")}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-medium">
                        <th className="px-6 py-4">{t("datahub.date")}</th>
                        <th className="px-6 py-4">{t("datahub.offset")}</th>
                        <th className="px-6 py-4">Moore APHV</th>
                        <th className="px-6 py-4">Mirwald APHV</th>
                        <th className="px-6 py-4">PAH (cm)</th>
                        <th className="px-6 py-4">% PAH</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedHistory.map((h) => (
                        <tr key={h.inputs.dataCollectionDate} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium">{formatDate(h.inputs.dataCollectionDate)}</td>
                          <td className="px-6 py-4 font-medium text-teal-600">{formatNumber(h.classification.primaryOffset, 2)}</td>
                          <td className="px-6 py-4">{formatNumber(h.methodOutputs.mooreAphv, 2)} {t("analysis.individual.years")}</td>
                          <td className="px-6 py-4">{formatNumber(h.methodOutputs.mirwaldAphv, 2)} {t("analysis.individual.years")}</td>
                          <td className="px-6 py-4">{h.methodOutputs.pahCm ? `${formatNumber(h.methodOutputs.pahCm, 2)} cm` : "N/A"}</td>
                          <td className="px-6 py-4">{h.methodOutputs.percentageAdultHeight ? `${formatNumber(h.methodOutputs.percentageAdultHeight, 2)}%` : "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'performance' && (
            <div className="space-y-6">
              {/* Performance Snapshot */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Trophy className="h-5 w-5 text-teal-600" />
                  <h3 className="font-bold text-slate-900">{t("analysis.individual.performanceTitle")}</h3>
                </div>
                {athletePerformance.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {athletePerformance.map(({ testName, latest, history, area }) => (
                      <div key={testName} className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                              <Target className="h-4 w-4 text-teal-600" />
                            </div>
                            <div className="font-semibold text-sm truncate max-w-[120px]">{testName}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-teal-600">{formatNumber(latest.value, 2)} {latest.unit}</div>
                            <div className="text-[10px] text-slate-400">{formatDate(latest.measurementDate)}</div>
                          </div>
                        </div>
                        {/* Sparkline */}
                        <div className="h-12 w-full mt-2 relative">
                          <ResponsiveContainer width="99.9%" height={48} minWidth={0} debounce={100}>
                            <LineChart data={history.map(h => ({ val: h.value }))}>
                              <Line type="monotone" dataKey="val" stroke="#0d9488" strokeWidth={2} dot={false} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Target className="h-12 w-12 mb-3 opacity-20" />
                    <p>{t("analysis.individual.noPerformance")}</p>
                  </div>
                )}
              </div>
              
              {/* Performance Metrics Evolution */}
              {athletePerformance.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                    <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Evolución de Rendimiento' : 'Performance Evolution'}</h3>
                  </div>
                  <div className="h-80 w-full relative">
                    <ResponsiveContainer width="99.9%" height={320} minWidth={0} debounce={100}>
                      <LineChart
                        data={(() => {
                          const allDates = Array.from(new Set(
                            athletePerformance.flatMap(p => p.history.map(h => h.measurementDate))
                          )).sort();
                          
                          return allDates.map(date => {
                            const entry: any = { date: formatDate(date) };
                            athletePerformance.forEach(p => {
                              const match = p.history.find(h => h.measurementDate === date);
                              if (match) entry[p.testName] = Number(match.value.toFixed(2));
                            });
                            return entry;
                          });
                        })()}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          formatter={(val: any) => [formatNumber(Number(val), 2), ""]}
                        />
                        <Legend verticalAlign="top" align="right" />
                        {athletePerformance.slice(0, 5).map((p, i) => (
                          <Line 
                            key={p.testName}
                            type="monotone" 
                            dataKey={p.testName} 
                            stroke={['#0d9488', '#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'][i % 5]} 
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Performance Comparison Chart (Multiple athletes) */}
              {comparisonIds.length > 0 && athletePerformance.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Activity className="h-5 w-5 text-amber-600" />
                    <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Comparativa de Rendimiento' : 'Performance Comparison'}</h3>
                  </div>
                  <div className="space-y-8">
                    {athletePerformance.slice(0, 3).map(test => (
                      <div key={test.testName} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold text-slate-500 uppercase">
                          <span>{test.testName} ({test.latest.unit})</span>
                        </div>
                        <div className="h-32 w-full relative">
                          <ResponsiveContainer width="99.9%" height={128} minWidth={0} debounce={100}>
                            <BarChart 
                              layout="vertical" 
                              data={[
                                { name: selectedLatest?.inputs.athleteName, val: test.latest.value, fill: '#0d9488' },
                                ...comparisonIds.map((id, i) => {
                                  const cLatest = latestByAthlete.find(la => la.inputs.athleteId === id);
                                  const cPerf = state.performanceEntries
                                    .filter(e => e.athleteId === id && e.testName === test.testName)
                                    .sort((a, b) => b.measurementDate.localeCompare(a.measurementDate))[0];
                                  return { 
                                    name: cLatest?.inputs.athleteName, 
                                    val: cPerf?.value || 0,
                                    fill: ['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'][i % 4]
                                  };
                                })
                              ]}
                              margin={{ left: 80 }}
                            >
                              <XAxis type="number" hide />
                              <YAxis type="category" dataKey="name" fontSize={10} width={80} />
                              <Tooltip formatter={(v) => formatNumber(Number(v), 2)} />
                              <Bar dataKey="val" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'load' && (
            <div className="space-y-6">
              {/* Training Load History */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Dumbbell className="h-5 w-5 text-teal-600" />
                  <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Historial de Carga de Entrenamiento' : 'Training Load History'}</h3>
                </div>
                
                {athleteLoad.length > 0 || comparisonIds.length > 0 ? (
                  <div className="space-y-6">
                    <div className="h-80 w-full relative">
                      <ResponsiveContainer width="99.9%" height={320} minWidth={0} debounce={100}>
                        <BarChart data={combinedLoadHistory}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                          <Legend verticalAlign="top" align="right" />
                          <Bar dataKey={selectedLatest?.inputs.athleteName} name={selectedLatest?.inputs.athleteName} fill="#0d9488" radius={[4, 4, 0, 0]} />
                          {comparisonIds.map((id, i) => {
                            const name = latestByAthlete.find(a => a.inputs.athleteId === id)?.inputs.athleteName || id;
                            return (
                              <Bar key={id} dataKey={name} name={name} fill={['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'][i % 4]} radius={[4, 4, 0, 0]} />
                            );
                          })}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 text-center">
                        <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">Media Semanal</p>
                        <p className="text-3xl font-bold text-teal-900">{formatNumber(athleteLoad.reduce((acc: number, l: TrainingLoadEntry) => acc + l.load, 0) / Math.max(1, athleteLoad.length), 0)}</p>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                        <p className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Minutos Totales</p>
                        <p className="text-3xl font-bold text-blue-900">{athleteLoad.reduce((acc: number, l: TrainingLoadEntry) => acc + l.minutesPlayed, 0)}</p>
                      </div>
                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-center">
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">RPE Medio</p>
                        <p className="text-3xl font-bold text-amber-900">{formatNumber(athleteLoad.reduce((acc: number, l: TrainingLoadEntry) => acc + l.rpe, 0) / Math.max(1, athleteLoad.length), 1)}</p>
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-medium">
                            <th className="px-4 py-3">Fecha</th>
                            <th className="px-4 py-3">Tipo</th>
                            <th className="px-4 py-3 text-right">Minutos</th>
                            <th className="px-4 py-3 text-right">RPE</th>
                            <th className="px-4 py-3 text-right font-bold">Carga</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {athleteLoad.slice(0, 10).map((l: TrainingLoadEntry, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-4 py-3">{formatDate(l.date)}</td>
                              <td className="px-4 py-3 capitalize">{l.sessionType}</td>
                              <td className="px-4 py-3 text-right">{l.minutesPlayed} min</td>
                              <td className="px-4 py-3 text-right">{l.rpe}</td>
                              <td className="px-4 py-3 text-right font-bold text-teal-600">{l.load}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Dumbbell className="h-12 w-12 mb-3 opacity-20" />
                    <p>{locale === 'es' ? 'No hay registros de carga para este atleta' : 'No training load records for this athlete'}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// COLLECTIVE TAB
// ---------------------------------------------------------------------------
function CollectiveView({
  assessments,
  state,
  t,
  locale,
  onBack,
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
  locale: string;
  onBack: () => void;
}) {
  const teams = useMemo(
    () => getUniqueAthleteTeams(state.athletes),
    [state.athletes],
  );

  const [selectedTeam, setSelectedTeam] = useState(teams[0] ?? "");

  const latestByAthlete = useMemo(
    () => getLatestAssessmentsByAthlete(assessments),
    [assessments],
  );

  const teamStats = useMemo(() => {
    if (!selectedTeam) return null;
    const teamData = latestByAthlete.filter((a) => a.inputs.teamName === selectedTeam);
    if (teamData.length === 0) return null;

    const offsets = teamData.map((a) => a.classification.primaryOffset);
    const meanOff = offsets.reduce((s, v) => s + v, 0) / offsets.length;
    const sdOff = offsets.length > 1 ? Math.sqrt(offsets.reduce((s, v) => s + (v - meanOff) ** 2, 0) / offsets.length) : 0;

    const bandCounts: Record<MaturityBand, number> = { "Pre-PHV": 0, "Mid-PHV": 0, "Post-PHV": 0 };
    teamData.forEach((a) => bandCounts[a.classification.maturityBand]++);

    const sorted = [...teamData].sort((a, b) => a.classification.primaryOffset - b.classification.primaryOffset);

    // Psychological preparation for the team (Only latest per athlete)
    const teamAthleteIds = new Set(teamData.map(a => a.inputs.athleteId));
    
    const latestPsychMap = new Map<string, PerformanceEntry>();
    state.performanceEntries
      .filter(e => e.area === "psychological" && teamAthleteIds.has(e.athleteId))
      .forEach(e => {
        const key = `${e.athleteId}-${e.testName}`;
        const existing = latestPsychMap.get(key);
        if (!existing || e.measurementDate > existing.measurementDate) {
          latestPsychMap.set(key, e);
        }
      });
    
    const psychEntries = Array.from(latestPsychMap.values());
    
    // Average psych scores
    const psychAverages = psychEntries.reduce((acc: Record<string, { total: number; count: number }>, e: PerformanceEntry) => {
      if (!acc[e.testName]) acc[e.testName] = { total: 0, count: 0 };
      acc[e.testName].total += e.value;
      acc[e.testName].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const psychScores = Object.entries(psychAverages).map(([name, data]) => ({
      name,
      value: Number((data.total / data.count).toFixed(2))
    }));

    return {
      athletes: teamData.map((a) => ({
        ...a,
        zScore: sdOff === 0 ? 0 : (a.classification.primaryOffset - meanOff) / sdOff,
      })),
      meanOffset: meanOff,
      meanAge: teamData.reduce((s: number, a: MaturationResult) => s + a.derivedMetrics.chronologicalAge, 0) / teamData.length,
      meanStature: teamData.reduce((s: number, a: MaturationResult) => s + a.inputs.statureCm, 0) / teamData.length,
      meanWeight: teamData.reduce((s: number, a: MaturationResult) => s + a.inputs.bodyMassKg, 0) / teamData.length,
      bandCounts,
      sdOffset: sdOff,
      earliest: sorted[0],
      latest: sorted[sorted.length - 1],
      maturitySpread: sorted.length > 1 ? sorted[sorted.length - 1].classification.primaryOffset - sorted[0].classification.primaryOffset : 0,
      psychScores,
    };
  }, [latestByAthlete, selectedTeam, state.performanceEntries]);

  // Hack to force Recharts to re-measure after animations/tab switches
  useEffect(() => {
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 300);
    return () => clearTimeout(timer);
  }, [selectedTeam]);

  const distributionData = teamStats
    ? (["Pre-PHV", "Mid-PHV", "Post-PHV"] as MaturityBand[]).map((band) => ({
        name: band,
        value: teamStats.bandCounts[band],
        fill: bandColors[band],
      }))
    : [];

  const offsetData = teamStats
    ? teamStats.athletes
        .map((a) => ({
          name: a.inputs.athleteName,
          offset: Number(a.classification.primaryOffset.toFixed(2)),
          zScore: Number(a.zScore.toFixed(2)),
          band: a.classification.maturityBand,
        }))
        .sort((a, b) => a.offset - b.offset)
    : [];

  const handleExportPDF = () => {
    window.print();
  };

  const getTeamAdvice = () => {
    if (!teamStats) return [];
    const advice = [];
    
    // Maturation-based advice
    const { bandCounts } = teamStats;
    const total = teamStats.athletes.length;
    
    if (bandCounts["Mid-PHV"] / total > 0.4) {
      advice.push({
        title: t("analysis.collective.adviceHighMidPHVTitle"),
        text: t("analysis.collective.adviceHighMidPHVText"),
        type: "warning"
      });
    } else if (bandCounts["Pre-PHV"] / total > 0.6) {
      advice.push({
        title: t("analysis.collective.adviceHighPrePHVTitle"),
        text: t("analysis.collective.adviceHighPrePHVText"),
        type: "info"
      });
    } else if (bandCounts["Post-PHV"] / total > 0.6) {
      advice.push({
        title: t("analysis.collective.adviceHighPostPHVTitle"),
        text: t("analysis.collective.adviceHighPostPHVText"),
        type: "success"
      });
    }

    // Psychological-based advice
    const lowPsych = teamStats.psychScores.filter(s => s.value < 6); // Assuming 1-10 scale
    if (lowPsych.length > 0) {
      advice.push({
        title: t("analysis.collective.advicePsychTitle"),
        text: t("analysis.collective.advicePsychText").replace("{metrics}", lowPsych.map(s => s.name).join(", ")),
        type: "warning"
      });
    }

    return advice;
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors no-print"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{locale === "es" ? "Volver" : "Back"}</span>
      </button>

      {/* Team selector */}
      <div className="flex items-center justify-between no-print">
        <select
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm"
        >
          <option value="">{t("analysis.collective.selectTeam")}</option>
          {teams.map((team) => (
            <option key={team} value={team}>{team}</option>
          ))}
        </select>
        <button 
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          {t("common.export")} PDF
        </button>
      </div>

      {!teamStats ? (
        <div className="h-48 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <p>{t("analysis.collective.noData")}</p>
        </div>
      ) : (
        <div className="space-y-6 print:space-y-8">
          <div className="hidden print:block border-b pb-4 mb-4">
            <h1 className="text-2xl font-bold">{t("analysis.collective.reportTitle")}: {selectedTeam}</h1>
            <p className="text-slate-500">{formatDate(new Date().toISOString())}</p>
          </div>

          {/* Advice Section */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-teal-600" />
                {t("analysis.collective.strategicAdvice")}
              </h3>
              <div className="space-y-3">
                {getTeamAdvice().map((a, i) => (
                  <div key={i} className={`p-4 rounded-xl border ${
                    a.type === "warning" ? "bg-amber-50 border-amber-200" :
                    a.type === "success" ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"
                  }`}>
                    <h4 className="font-bold text-sm mb-1">{a.title}</h4>
                    <p className="text-sm opacity-90">{a.text}</p>
                  </div>
                ))}
                {getTeamAdvice().length === 0 && (
                  <p className="text-sm text-slate-500 italic">{t("analysis.collective.noAdvice")}</p>
                )}
              </div>
            </div>

            <div className="panel rounded-[1.75rem] p-6">
              <h2 className="mb-4 text-lg font-semibold">{t("analysis.collective.distributionTitle")}</h2>
              <div className="h-56 w-full relative">
                <ResponsiveContainer width="99.9%" height={224} minWidth={0} debounce={100}>
                  <PieChart>
                    <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [formatNumber(Number(val), 0), t("analysisExtra.count")]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="metric-card rounded-[1.75rem] p-5 relative group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-ink-soft">{t("analysis.collective.avgOffset")}</p>
                <div className="relative group/tooltip">
                  <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none font-normal">
                    {t("analysis.collective.avgOffsetExplanation")}
                    <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
              </div>
              <p suppressHydrationWarning className="mt-2 text-3xl font-semibold">{formatNumber(teamStats.meanOffset, 2)}</p>
            </div>
            <div className="metric-card rounded-[1.75rem] p-5 relative group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-ink-soft">{t("analysis.collective.avgAge")}</p>
                <div className="relative group/tooltip">
                  <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none font-normal">
                    {t("analysis.collective.avgAgeExplanation")}
                    <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
              </div>
              <p suppressHydrationWarning className="mt-2 text-3xl font-semibold">{formatNumber(teamStats.meanAge, 2)} {t("analysis.collective.years")}</p>
            </div>
            <div className="metric-card rounded-[1.75rem] p-5 relative group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-ink-soft">{t("analysis.collective.avgStature")}</p>
                <div className="relative group/tooltip">
                  <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none font-normal">
                    {t("analysis.collective.avgStatureExplanation")}
                    <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
              </div>
              <p suppressHydrationWarning className="mt-2 text-3xl font-semibold">{formatNumber(teamStats.meanStature, 2)} cm</p>
            </div>
            <div className="metric-card rounded-[1.75rem] p-5 relative group">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm text-ink-soft">{t("analysis.collective.avgWeight")}</p>
                <div className="relative group/tooltip">
                  <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                  <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none font-normal">
                    {t("analysis.collective.avgWeightExplanation")}
                    <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                  </div>
                </div>
              </div>
              <p suppressHydrationWarning className="mt-2 text-3xl font-semibold">{formatNumber(teamStats.meanWeight, 2)} kg</p>
            </div>
          </div>

          {/* Extra stats */}
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">{t("analysis.collective.earliestMaturity")}</p>
              <p className="mt-1 font-semibold">{teamStats.earliest.inputs.athleteName}</p>
              <p className="text-sm text-teal-600">{formatNumber(teamStats.earliest.classification.primaryOffset, 2)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">{t("analysis.collective.latestMaturity")}</p>
              <p className="mt-1 font-semibold">{teamStats.latest.inputs.athleteName}</p>
              <p className="text-sm text-blue-600">{formatNumber(teamStats.latest.classification.primaryOffset, 2)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-sm text-slate-500">{t("analysis.collective.maturitySpread")}</p>
              <p className="mt-1 font-semibold">{formatNumber(teamStats.maturitySpread, 2)} {t("analysis.collective.years")}</p>
              <p className="text-xs text-slate-400">{t("analysis.collective.sd")}: {formatNumber(teamStats.sdOffset, 2)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel rounded-[1.75rem] p-6">
              <h2 className="mb-4 text-lg font-semibold">{t("analysis.collective.offsetsTitle")}</h2>
              <div className="h-64 w-full relative">
                <ResponsiveContainer width="99.9%" height={256} minWidth={0} debounce={100}>
                  <BarChart data={offsetData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.08)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(val: any) => [formatNumber(Number(val), 2), t("datahub.offset")]} />
                    <Bar dataKey="offset" radius={[6, 6, 0, 0]} barSize={24}>
                      {offsetData.map((entry, i) => (
                        <Cell key={i} fill={bandColors[entry.band as keyof typeof bandColors]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="panel rounded-[1.75rem] p-6">
              <h2 className="mb-4 text-lg font-semibold">{t("analysis.collective.psychologicalProfile")}</h2>
              <div className="h-64 w-full relative">
                {teamStats.psychScores.length > 0 ? (
                  <ResponsiveContainer width="99.9%" height={256} minWidth={0} debounce={100}>
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={teamStats.psychScores}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} />
                      <Radar name={t("analysis.collective.teamMean")} dataKey="value" stroke="#0f766e" fill="#0f766e" fillOpacity={0.5} />
                      <Tooltip formatter={(val: any) => [formatNumber(Number(val), 2), t("analysis.collective.teamMean")]} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                    {t("analysis.collective.noPsychological")}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Full athlete table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold">{selectedTeam} — {t("analysis.collective.bandCounts")}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">{t("datahub.player")}</th>
                    <th className="px-6 py-3 font-semibold">{t("datahub.age")}</th>
                    <th className="px-6 py-3 font-semibold">{t("datahub.stature")}</th>
                    <th className="px-6 py-3 font-semibold">{t("datahub.offset")}</th>
                    <th className="px-6 py-3 font-semibold">Z-Score</th>
                    <th className="px-6 py-3 font-semibold">{t("analysisExtra.maturityBand")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {teamStats.athletes.map((a) => (
                    <tr key={a.inputs.athleteId} className="hover:bg-slate-50/50">
                      <td className="px-6 py-3 font-medium">{a.inputs.athleteName}</td>
                      <td className="px-6 py-3">{formatNumber(a.derivedMetrics.chronologicalAge, 2)}</td>
                      <td className="px-6 py-3">{formatNumber(a.inputs.statureCm, 2)} cm</td>
                      <td suppressHydrationWarning className="px-6 py-3 font-medium text-teal-600">{formatNumber(a.classification.primaryOffset, 2)}</td>
                      <td suppressHydrationWarning className="px-6 py-3">
                        <span className={`font-semibold ${
                          a.zScore > 1 ? "text-amber-600" : a.zScore < -1 ? "text-blue-600" : "text-slate-600"
                        }`}>
                          {formatNumber(a.zScore, 2)}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          a.classification.maturityBand === "Pre-PHV" ? "bg-teal-100 text-teal-700" :
                          a.classification.maturityBand === "Mid-PHV" ? "bg-amber-100 text-amber-700" :
                          "bg-slate-200 text-slate-700"
                        }`}>
                          {a.classification.maturityBand}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ASSISTANT TAB
// ---------------------------------------------------------------------------
function AssistantView({
  assessments,
  state,
  t,
  locale,
  onBack,
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
  locale: string;
  onBack: () => void;
}) {
  const alerts = useMemo(() => buildAlerts(assessments), [assessments]);
  const rapidGrowth = useMemo(() => detectRapidGrowth(assessments), [assessments]);

  // Combine and deduplicate alerts by athlete for the assistant view
  const athleteStatus = useMemo(() => {
    const map = new Map<string, { 
      name: string; 
      team?: string; 
      band: MaturityBand; 
      alerts: AlertItem[]; 
      advice: string[] 
    }>();

    // Latest assessments to get current band
    const latestMap = new Map(
      getLatestAssessmentsByAthlete(assessments).map((assessment) => [
        assessment.inputs.athleteId,
        assessment,
      ]),
    );

    latestMap.forEach((a, id) => {
      const advice: string[] = [];
      if (a.classification.maturityBand === "Mid-PHV") {
        advice.push(t("analysis.assistant.growthSpurtAdvice"));
      } else if (a.classification.maturityBand === "Pre-PHV") {
        advice.push(t("analysis.assistant.prePHVAdvice"));
      } else {
        advice.push(t("analysis.assistant.postPHVAdvice"));
      }

      map.set(id, {
        name: a.inputs.athleteName,
        team: a.inputs.teamName,
        band: a.classification.maturityBand,
        alerts: alerts.filter(al => al.athleteName === a.inputs.athleteName),
        advice,
      });
    });

        rapidGrowth.forEach(rg => {
          const entry = map.get(rg.athleteId);
          if (entry) {
            entry.alerts.push({
              id: rg.id,
              severity: "warning",
              athleteName: rg.athleteName,
              teamName: rg.teamName,
              category: "rapidGrowth",
              message: t("analysis.assistant.rapidGrowth") + `: +${formatNumber(rg.statureGain, 2)}cm`,
              detail: t("analysis.assistant.rapidGrowthDetail").replace("{rate}", formatNumber(rg.monthlyRate, 2))
            });
          }
        });

    return Array.from(map.values()).filter(a => a.alerts.length > 0 || a.band === "Mid-PHV");
  }, [assessments, alerts, rapidGrowth, t]);

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition-colors no-print"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>{locale === "es" ? "Volver" : "Back"}</span>
      </button>

      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-800">{t("analysis.assistant.title")}</h2>
          <p className="text-sm text-slate-500">{t("analysis.assistant.subtitle")}</p>
        </div>
        <button 
          onClick={handleExportPDF}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-medium hover:bg-slate-700 transition-colors"
        >
          <Download className="h-4 w-4" />
          {t("common.export")} PDF
        </button>
      </div>

      <div className="hidden print:block border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">{t("analysis.assistant.reportTitle")}</h1>
        <p className="text-slate-500">{t("analysis.assistant.reportTitle")} · {formatDate(new Date().toISOString())}</p>
      </div>

      {athleteStatus.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <Shield size={48} className="mb-4 opacity-20" />
          <p>{t("analysis.assistant.noAlerts")}</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {athleteStatus.map((status, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm print:break-inside-avoid">
              <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg">{status.name}</h3>
                  <p className="text-xs text-slate-500">{status.team} · <span suppressHydrationWarning className={`font-semibold ${
                    status.band === "Mid-PHV" ? "text-amber-600" : status.band === "Pre-PHV" ? "text-teal-600" : "text-slate-600"
                  }`}>{status.band}</span></p>
                </div>
                {status.band === "Mid-PHV" && (
                  <div suppressHydrationWarning className="flex items-center gap-1 bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold">
                    <Zap size={14} />
                    {t("analysis.assistant.growthSpurt")}
                  </div>
                )}
              </div>
              
              <div className="p-5 grid gap-6 md:grid-cols-2">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <AlertTriangle size={14} className="text-amber-500" />
                    {t("analysis.assistant.injuryRisk")} / Alertas
                  </h4>
                  <div className="space-y-3">
                    {status.alerts.map((alert, j) => (
                      <div key={j} className={`p-3 rounded-xl border-l-4 ${
                        alert.severity === "critical" ? "bg-red-50 border-red-500" : "bg-amber-50 border-amber-500"
                      }`}>
                        <p className="text-sm font-bold">{alert.message}</p>
                        {alert.detail && <p className="text-xs text-slate-600 mt-1">{alert.detail}</p>}
                      </div>
                    ))}
                    {status.alerts.length === 0 && (
                      <p className="text-sm text-slate-400 italic">{t("analysis.assistant.noSpecificAlerts")}</p>
                    )}
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-teal-500" />
                    {t("analysis.assistant.trainingAdvice")}
                  </h4>
                  <div className="space-y-3">
                    {status.advice.map((adv, j) => (
                      <div key={j} className="p-3 bg-teal-50 rounded-xl border border-teal-100">
                        <p className="text-sm text-teal-800 leading-relaxed">{adv}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selection View
// ---------------------------------------------------------------------------
function AnalysisSelection({
  onSelect,
  t,
  locale,
}: {
  onSelect: (t: AnalysisTab) => void;
  t: (k: string) => string;
  locale: string;
}) {
  const options: { id: AnalysisTab; icon: React.ReactNode; color: string; desc: string }[] = [
    {
      id: "individual",
      icon: <Users className="h-8 w-8" />,
      color: "bg-teal-50 text-teal-600 border-teal-100",
      desc: locale === "es" 
        ? "Perfil de maduración de cada jugador y su evolución temporal."
        : "Individual maturation profile and temporal evolution.",
    },
    {
      id: "collective",
      icon: <Group className="h-8 w-8" />,
      color: "bg-blue-50 text-blue-600 border-blue-100",
      desc: locale === "es"
        ? "Comparativa de grupos, equipos y distribución de la plantilla."
        : "Team comparison, groups and squad distribution.",
    },
    {
      id: "assistant",
      icon: <Activity className="h-8 w-8" />,
      color: "bg-amber-50 text-amber-600 border-amber-100",
      desc: locale === "es"
        ? "Alertas preventivas y consejos de entrenamiento personalizados."
        : "Preventive alerts and personalized training advice.",
    },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {options.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onSelect(opt.id)}
          className="group flex flex-col items-start p-8 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300 transition-all text-left"
        >
          <div className={`p-4 rounded-2xl mb-6 transition-transform group-hover:scale-110 ${opt.color}`}>
            {opt.icon}
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">
            {t(`analysis.tabs.${opt.id}`)}
          </h3>
          <p className="text-slate-500 leading-relaxed">
            {opt.desc}
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm font-bold text-slate-900 group-hover:translate-x-2 transition-transform">
            {t("common.open") || "Entrar"}
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Analysis Page
// ---------------------------------------------------------------------------
export default function AnalysisPage() {
  const { assessments, state } = useAppState();
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();

  const queryTab = searchParams.get("tab");
  const initialTab: AnalysisTab | null =
    queryTab === "individual" || queryTab === "collective" || queryTab === "assistant"
      ? queryTab
      : null;
  const [activeTab, setActiveTab] = useState<AnalysisTab | null>(initialTab);

  const tabLabels: Record<AnalysisTab, string> = {
    individual: t("analysis.tabs.individual"),
    collective: t("analysis.tabs.collective"),
    assistant: t("analysis.tabs.assistant"),
  };

  const tabs: { id: AnalysisTab; label: string }[] = [
    { id: "individual", label: tabLabels.individual },
    { id: "collective", label: tabLabels.collective },
    { id: "assistant",  label: tabLabels.assistant  },
  ];

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full min-w-0">
      {/* Sidebar */}
      <nav className="w-56 border-r border-line bg-white/95 flex-shrink-0" aria-label="Analysis sections">
        <div className="p-4 space-y-1">
          <button
            type="button"
            onClick={() => setActiveTab(null)}
            className="w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition text-zinc-600 hover:bg-zinc-100 mb-2"
          >
            <Home className="h-5 w-5" />
            {t("datahub.landingTitle")}
          </button>
          <div className="border-t border-line pt-2">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  activeTab === id
                    ? "bg-accent text-white"
                    : "text-zinc-600 hover:bg-zinc-100"
                }`}
              >
                {id === "individual" && <Users className="h-5 w-5" />}
                {id === "collective" && <Shield className="h-5 w-5" />}
                {id === "assistant"  && <Activity className="h-5 w-5" />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="min-w-0 flex-1 p-6 space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("analysis.title")}</h1>
            <p className="mt-1 text-slate-500">{t("analysis.subtitle")}</p>
          </div>
        </header>

        {!activeTab && (
          <AnalysisSelection onSelect={setActiveTab} t={t} locale={locale} />
        )}

        <div>
          {activeTab === "individual" && (
            <IndividualView assessments={assessments} state={state} t={t} locale={locale} onBack={() => setActiveTab(null)} />
          )}
          {activeTab === "collective" && (
            <CollectiveView assessments={assessments} state={state} t={t} locale={locale} onBack={() => setActiveTab(null)} />
          )}
          {activeTab === "assistant" && (
            <AssistantView assessments={assessments} state={state} t={t} locale={locale} onBack={() => setActiveTab(null)} />
          )}
        </div>
      </main>

      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }
          .no-print {
            display: none !important;
          }
          aside, nav, header:not(.print-header) {
            display: none !important;
          }
          .min-h-screen {
            min-height: auto !important;
            padding: 0 !important;
          }
          .mx-auto {
            margin: 0 !important;
            max-width: 100% !important;
          }
          .shadow-sm, .shadow {
            box-shadow: none !important;
          }
          .border {
            border-color: #e2e8f0 !important;
          }
          .rounded-2xl, .rounded-xl {
            border-radius: 8px !important;
          }
          .print\:space-y-8 > * + * {
            margin-top: 2rem !important;
          }
          .print\:break-inside-avoid {
            break-inside: avoid !important;
          }
        }
      `}</style>
    </div>
  );
}