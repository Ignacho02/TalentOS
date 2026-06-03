"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ResponsiveContainer,
  ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, Filter,
  Search, TrendingUp, Users, Calendar, MapPin, Target,
  Dumbbell, Shield, Activity, Group, Trophy, Zap, Download,
  ArrowLeft, ArrowRight, Info, X, Menu, Maximize2
} from "lucide-react";
import { buildInsights } from "@/lib/maturation/insights";
import { useAppState } from "@/lib/store/app-state";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
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
import type { MaturityBand, PerformanceArea, TrainingLoadEntry, PerformanceEntry, MaturationResult } from "@/lib/types";
import type { TeamStats, AlertItem, RapidGrowthAlert } from "@/lib/maturation/analysis-helpers";

const bandColors: Record<string, string> = {
  "Pre-PHV": "#0f766e",
  "Mid-PHV": "#b45309",
  "Post-PHV": "#0f172a",
};

const performanceAreaChartColors: Record<PerformanceArea, string> = {
  physical: "#3b82f6",
  technicalTactical: "#8b5cf6",
  psychological: "#f59e0b",
  motorSkills: "#10b981",
};

const performanceAreaOrder: PerformanceArea[] = ["physical", "technicalTactical", "psychological", "motorSkills"];

const performanceAreaStyles: Record<PerformanceArea, {
  chipActive: string;
  chipIdle: string;
  softText: string;
  icon: string;
  ring: string;
}> = {
  physical: {
    chipActive: "border-blue-300 bg-blue-600 text-white",
    chipIdle: "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300 hover:bg-blue-100",
    softText: "text-blue-700",
    icon: "text-blue-600",
    ring: "hover:border-blue-200 focus:ring-blue-500/20",
  },
  technicalTactical: {
    chipActive: "border-violet-300 bg-violet-600 text-white",
    chipIdle: "border-violet-200 bg-violet-50 text-violet-700 hover:border-violet-300 hover:bg-violet-100",
    softText: "text-violet-700",
    icon: "text-violet-600",
    ring: "hover:border-violet-200 focus:ring-violet-500/20",
  },
  psychological: {
    chipActive: "border-amber-300 bg-amber-500 text-white",
    chipIdle: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100",
    softText: "text-amber-700",
    icon: "text-amber-600",
    ring: "hover:border-amber-200 focus:ring-amber-500/20",
  },
  motorSkills: {
    chipActive: "border-emerald-300 bg-emerald-600 text-white",
    chipIdle: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100",
    softText: "text-emerald-700",
    icon: "text-emerald-600",
    ring: "hover:border-emerald-200 focus:ring-emerald-500/20",
  },
};

type AnalysisTab = "individual" | "collective" | "assistant";
type IndividualSubTab = "maturation" | "performance" | "load";
type ExpandedPerformanceComparisonCandidate = {
  athleteId: string;
  name: string;
  teamName: string;
  position: string;
  maturityBand: MaturityBand;
  value: number;
  unit: string;
};

type PerformancePercentileStrip = {
  testName: string;
  area: PerformanceArea;
  unit: string;
  min: number;
  max: number;
  value: number;
  percentile: number;
};

// ---------------------------------------------------------------------------
// INDIVIDUAL TAB
// ---------------------------------------------------------------------------
function IndividualView({
  assessments,
  state,
  t,
  locale,
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
  locale: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const teams = useMemo(
    () => getUniqueAthleteTeams(state.athletes),
    [state.athletes],
  );

  const updateUrl = (params: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) {
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
    }
    router.replace(`/analysis?${next.toString()}`, { scroll: false });
  };

  const initialPlayer = searchParams.get("player") || null;
  const initialSubTab = ((): IndividualSubTab => {
    const s = searchParams.get("subtab");
    if (s === "performance" || s === "load") return s;
    return "maturation";
  })();
  // When the URL explicitly specifies a subtab, clear the sessionStorage key so
  // usePersistentState's mount effect doesn't override the URL value.
  if (typeof window !== "undefined" && searchParams.get("subtab")) {
    sessionStorage.removeItem("analysis_indiv_subtab");
  }

  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterBand, setFilterBand] = useState("");
  const [comparisonMode, setComparisonMode] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(initialPlayer);
  const [comparisonIds, setComparisonIds] = usePersistentState<string[]>("analysis_indiv_compare", []);
  const [comparisonConfig, setComparisonConfig] = usePersistentState<{
    mode: 'team' | 'athletes' | 'external-team';
    externalTeam?: string;
  }>("analysis_indiv_comp_config", { mode: 'team' });
  const [compSearch, setCompSearch] = useState("");
  const [compTeam, setCompTeam] = useState("");
  const [compPos, setCompPos] = useState("");
  const [showComparisonPanel, setShowComparisonPanel] = usePersistentState<boolean>("analysis_indiv_comp_panel", false);
  const [activeSubTab, setActiveSubTab] = usePersistentState<IndividualSubTab>("analysis_indiv_subtab", initialSubTab);
  const [expandedTeams, setExpandedTeams] = useState<Record<string, boolean>>({});
  const [isSelectorExpanded, setIsSelectorExpanded] = useState(!initialPlayer);
  const [performanceTestAreas, setPerformanceTestAreas] = usePersistentState<string[]>("analysis_indiv_perf_areas", []);
  const [performanceSelectedTests, setPerformanceSelectedTests] = usePersistentState<string[]>("analysis_indiv_perf_tests", []);
  const [expandedPerformanceTestName, setExpandedPerformanceTestName] = useState<string | null>(null);
  const [expandedPerformanceComparisonIds, setExpandedPerformanceComparisonIds] = useState<string[]>([]);
  const [expandedPerformanceTeamFilter, setExpandedPerformanceTeamFilter] = useState("");
  const [expandedPerformancePositionFilter, setExpandedPerformancePositionFilter] = useState("");
  const [expandedPerformanceBandFilter, setExpandedPerformanceBandFilter] = useState<MaturityBand | "">("");

  // Hack to force Recharts to re-measure after animations/tab switches
  useEffect(() => {
    const player = searchParams.get("player") || null;
    setSelectedAthleteId(player);
    const subtab = searchParams.get("subtab");
    if (subtab === "maturation" || subtab === "performance" || subtab === "load") {
      setActiveSubTab(subtab);
    }
  }, [searchParams]);

  // Auto-collapse selector when a primary player is picked
  useEffect(() => {
    if (selectedAthleteId && comparisonIds.length === 0) {
      setIsSelectorExpanded(false);
    }
  }, [selectedAthleteId, comparisonIds]);

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
  const isComparisonTeamMode = activeComparisonAthletes.length > 4;

  const getAreaLabel = (area: string) => {
    const areaKey = `datahub.performance${area.charAt(0).toUpperCase()}${area.slice(1)}`;
    return t(areaKey) || area;
  };

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

  const maturityOffsetChartData = useMemo(
    () =>
      teamAssessments.map((assessment) => ({
        athleteId: assessment.inputs.athleteId,
        name: assessment.inputs.athleteName,
        offset: Number(assessment.classification.primaryOffset.toFixed(2)),
      })),
    [teamAssessments],
  );

  const combinedHistory = useMemo(() => {
    if (!selectedLatest) return [];
    const dates = new Set<string>();
    selectedHistory.forEach(h => dates.add(h.inputs.dataCollectionDate));
    comparisonHistories.forEach(ch => {
      ch.history.forEach(h => dates.add(h.inputs.dataCollectionDate));
    });

    return Array.from(dates).sort().map(date => {
      const entry: any = { date: formatDate(date) };
      const values: number[] = [];
      const primaryMatch = selectedHistory.find(h => h.inputs.dataCollectionDate === date);
      if (primaryMatch) {
        const value = Number(primaryMatch.classification.primaryOffset.toFixed(2));
        entry[selectedLatest.inputs.athleteName] = value;
        entry.growthVelocity = primaryMatch.derivedMetrics.growthVelocityCmPerYear != null
          ? Number(primaryMatch.derivedMetrics.growthVelocityCmPerYear.toFixed(1))
          : null;
        entry.stature = Number(primaryMatch.inputs.statureCm.toFixed(1));
        values.push(value);
      }
      comparisonHistories.forEach(ch => {
        const match = ch.history.find(h => h.inputs.dataCollectionDate === date);
        if (match) {
          const value = Number(match.classification.primaryOffset.toFixed(2));
          entry[ch.name] = value;
          values.push(value);
        }
      });
      if (isComparisonTeamMode) {
        entry.meanOffset = values.length ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)) : null;
      }
      return entry;
    });
  }, [selectedHistory, comparisonHistories, selectedLatest, isComparisonTeamMode]);

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
    }).filter(Boolean) as { testName: string, area: PerformanceArea, latest: any, history: any[] }[];
  }, [state.performanceEntries, state.performanceDefinitions, selectedAthleteId]);

  const activePerformanceSelectedTests = useMemo(() => {
    const availableTests = new Set(athletePerformance.map((test) => test.testName));
    return performanceSelectedTests.filter((testName) => availableTests.has(testName));
  }, [athletePerformance, performanceSelectedTests]);

  const filteredAthletePerformance = useMemo(() => {
    if (activePerformanceSelectedTests.length === 0) return athletePerformance;
    return athletePerformance.filter((p) => activePerformanceSelectedTests.includes(p.testName));
  }, [activePerformanceSelectedTests, athletePerformance]);

  const expandedPerformanceTest = useMemo(
    () => athletePerformance.find((test) => test.testName === expandedPerformanceTestName) ?? null,
    [athletePerformance, expandedPerformanceTestName],
  );

  const expandedPerformanceComparisonCandidates = useMemo(() => {
    if (!expandedPerformanceTestName || !selectedAthleteId) return [];

    return latestByAthlete
      .filter((athlete) => athlete.inputs.athleteId !== selectedAthleteId)
      .map((athlete) => {
        const athleteProfile = state.athletes.find((profile) => profile.id === athlete.inputs.athleteId);
        const latestEntry = state.performanceEntries
          .filter((entry) => entry.athleteId === athlete.inputs.athleteId && entry.testName === expandedPerformanceTestName)
          .sort((a, b) => b.measurementDate.localeCompare(a.measurementDate))[0];

        if (!latestEntry) return null;

        return {
          athleteId: athlete.inputs.athleteId,
          name: athlete.inputs.athleteName,
          teamName: athlete.inputs.teamName,
          position: athlete.inputs.position || athleteProfile?.position || "",
          maturityBand: athlete.classification.maturityBand,
          value: latestEntry.value,
          unit: latestEntry.unit,
        };
      })
      .filter((candidate): candidate is ExpandedPerformanceComparisonCandidate => candidate !== null)
      .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.name.localeCompare(b.name));
  }, [expandedPerformanceTestName, latestByAthlete, selectedAthleteId, state.athletes, state.performanceEntries]);

  const expandedPerformanceTeamOptions = useMemo(
    () => Array.from(new Set(expandedPerformanceComparisonCandidates.map((candidate) => candidate.teamName).filter(Boolean))).sort(),
    [expandedPerformanceComparisonCandidates],
  );

  const expandedPerformancePositionOptions = useMemo(
    () => Array.from(new Set(expandedPerformanceComparisonCandidates.map((candidate) => candidate.position).filter(Boolean))).sort(),
    [expandedPerformanceComparisonCandidates],
  );

  const expandedPerformanceBandOptions = useMemo(
    () => (["Pre-PHV", "Mid-PHV", "Post-PHV"] as MaturityBand[]).filter((band) =>
      expandedPerformanceComparisonCandidates.some((candidate) => candidate.maturityBand === band),
    ),
    [expandedPerformanceComparisonCandidates],
  );

  const filteredExpandedPerformanceComparisonCandidates = useMemo(() => {
    return expandedPerformanceComparisonCandidates.filter((candidate) => {
      if (expandedPerformanceTeamFilter && candidate.teamName !== expandedPerformanceTeamFilter) return false;
      if (expandedPerformancePositionFilter && candidate.position !== expandedPerformancePositionFilter) return false;
      if (expandedPerformanceBandFilter && candidate.maturityBand !== expandedPerformanceBandFilter) return false;
      return true;
    });
  }, [
    expandedPerformanceBandFilter,
    expandedPerformanceComparisonCandidates,
    expandedPerformancePositionFilter,
    expandedPerformanceTeamFilter,
  ]);

  const expandedPerformanceComparisons = useMemo(() => {
    if (!expandedPerformanceTestName) return [];
    const ids = new Set(expandedPerformanceComparisonIds);

    return latestByAthlete
      .filter((athlete) => ids.has(athlete.inputs.athleteId))
      .map((athlete) => {
        const history = state.performanceEntries
          .filter((entry) => entry.athleteId === athlete.inputs.athleteId && entry.testName === expandedPerformanceTestName)
          .sort((a, b) => a.measurementDate.localeCompare(b.measurementDate))
          .map((entry) => ({
            value: entry.value,
            measurementDate: entry.measurementDate,
          }));

        if (history.length === 0) return null;

        return {
          id: athlete.inputs.athleteId,
          name: athlete.inputs.athleteName,
          history,
        };
      })
      .filter((comparison): comparison is { id: string; name: string; history: { value: number; measurementDate: string }[] } => comparison !== null);
  }, [expandedPerformanceComparisonIds, expandedPerformanceTestName, latestByAthlete, state.performanceEntries]);

  const expandedPerformanceChartData = useMemo(() => {
    if (!expandedPerformanceTest) return [];

    const dates = new Set<string>();
    expandedPerformanceTest.history.forEach((entry) => dates.add(entry.measurementDate));
    expandedPerformanceComparisons.forEach((comparison) => {
      comparison.history.forEach((entry) => dates.add(entry.measurementDate));
    });

    return Array.from(dates).sort().map((date) => {
      const row: Record<string, string | number> = { date: formatDate(date) };
      const primaryEntry = expandedPerformanceTest.history.find((entry) => entry.measurementDate === date);
      if (primaryEntry) row.primary = Number(primaryEntry.value.toFixed(2));

      expandedPerformanceComparisons.forEach((comparison) => {
        const comparisonEntry = comparison.history.find((entry) => entry.measurementDate === date);
        if (comparisonEntry) row[comparison.id] = Number(comparisonEntry.value.toFixed(2));
      });

      return row;
    });
  }, [expandedPerformanceComparisons, expandedPerformanceTest]);

  const performancePercentileStrips = useMemo(() => {
    if (!selectedLatest || filteredAthletePerformance.length === 0) return [];
    const comparisonAthleteIds = new Set([selectedLatest.inputs.athleteId, ...comparisonLatest.map(a => a.inputs.athleteId)]);

    return filteredAthletePerformance.map((test) => {
      const latestByAthlete = state.performanceEntries
        .filter((e) => e.testName === test.testName && comparisonAthleteIds.has(e.athleteId))
        .reduce<Record<string, PerformanceEntry>>((acc, e) => {
          const existing = acc[e.athleteId];
          if (!existing || e.measurementDate > existing.measurementDate) {
            acc[e.athleteId] = e;
          }
          return acc;
        }, {});

      const values = Object.values(latestByAthlete).map((e) => e.value).sort((a, b) => a - b);
      if (values.length === 0) return null;

      const current = test.latest.value;
      const rank = values.filter((v) => v <= current).length;
      const percentile = Math.max(1, Math.min(99, values.length > 1 ? Math.round(((rank - 1) / (values.length - 1)) * 100) : 50));

      return {
        testName: test.testName,
        area: test.area,
        unit: test.latest.unit,
        min: values[0],
        max: values[values.length - 1],
        value: current,
        percentile,
      };
    }).filter((strip): strip is PerformancePercentileStrip => strip !== null).sort((a, b) => {
      const areaDelta = performanceAreaOrder.indexOf(a.area) - performanceAreaOrder.indexOf(b.area);
      if (areaDelta !== 0) return areaDelta;
      return b.percentile - a.percentile || a.testName.localeCompare(b.testName);
    });
  }, [selectedLatest, filteredAthletePerformance, state.performanceEntries, comparisonLatest]);

  const performanceComparisonDotPlots = useMemo(() => {
    if (!selectedLatest || comparisonIds.length === 0 || filteredAthletePerformance.length === 0) return [];

    return filteredAthletePerformance.slice(0, 3).map((test) => {
      const points = [selectedLatest, ...comparisonLatest]
        .map((athlete) => {
          const latestEntry = state.performanceEntries
            .filter((e) => e.athleteId === athlete.inputs.athleteId && e.testName === test.testName)
            .sort((a, b) => b.measurementDate.localeCompare(a.measurementDate))[0];

          return {
            athleteId: athlete.inputs.athleteId,
            name: athlete.inputs.athleteName,
            value: latestEntry?.value ?? 0,
            y: 1,
            isPrimary: athlete.inputs.athleteId === selectedAthleteId,
            isComparison: athlete.inputs.athleteId !== selectedAthleteId,
          };
        })
        .filter((p) => p.value !== undefined);

      const values = points.map((p) => p.value);
      const min = values.length > 0 ? Math.min(...values) : 0;
      const max = values.length > 0 ? Math.max(...values) : 0;

      return {
        testName: test.testName,
        area: test.area,
        unit: test.latest.unit,
        points,
        min,
        max,
      };
    });
  }, [selectedLatest, comparisonIds, comparisonLatest, filteredAthletePerformance, state.performanceEntries, selectedAthleteId]);

  const athleteLoadTrend = useMemo(() => {
    if (athleteLoad.length === 0) return [];
    const acuteAlpha = 2 / (7 + 1);
    const chronicAlpha = 2 / (28 + 1);
    let acute = athleteLoad[0].load;
    let chronic = athleteLoad[0].load;

    return athleteLoad.map((entry, index) => {
      if (index > 0) {
        acute = acuteAlpha * entry.load + (1 - acuteAlpha) * acute;
        chronic = chronicAlpha * entry.load + (1 - chronicAlpha) * chronic;
      }
      return {
        date: formatDate(entry.date),
        load: entry.load,
        acute: Number(acute.toFixed(1)),
        chronic: Number(chronic.toFixed(1)),
      };
    });
  }, [athleteLoad]);

  const maturationTimelinePoints = useMemo(() => {
    return selectedHistory.map((h) => ({
      date: formatDate(h.inputs.dataCollectionDate),
      band: h.classification.maturityBand,
      offset: Number(h.classification.primaryOffset.toFixed(2)),
    }));
  }, [selectedHistory]);

  const performanceTestTypes = useMemo(() => {
    if (!state.performanceDefinitions) return [];
    return Array.from(new Set(state.performanceDefinitions.map((t) => t.area))).sort();
  }, [state.performanceDefinitions]);

  const performanceTestsByArea = useMemo(() => {
    if (!state.performanceDefinitions) return {};
    return state.performanceDefinitions.reduce<Record<string, string[]>>((acc, test) => {
      if (!acc[test.area]) acc[test.area] = [];
      acc[test.area].push(test.name);
      return acc;
    }, {});
  }, [state.performanceDefinitions]);

  const handleExportPDF = () => {
    window.print();
  };

  const subTabs: { id: IndividualSubTab; label: string; Icon: typeof TrendingUp }[] = [
    { id: "maturation", label: locale === "es" ? "Maduracion" : "Maturation", Icon: TrendingUp },
    { id: "performance", label: locale === "es" ? "Rendimiento" : "Performance", Icon: Trophy },
    { id: "load", label: locale === "es" ? "Carga de entrenamiento" : "Training Load", Icon: Dumbbell },
  ];

  return (
    <div className="space-y-6">
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

              {(search || filterTeam || filterBand) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilterTeam("");
                    setFilterBand("");
                  }}
                  className="flex items-center gap-1.5 rounded-full bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 px-4 py-2 text-sm font-semibold transition"
                >
                  <X className="h-4 w-4" />
                  {locale === 'es' ? 'Reiniciar Filtros' : 'Reset Filters'}
                </button>
              )}

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
                                updateUrl({ player: a.inputs.athleteId });
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
                      onClick={() => setComparisonConfig(c => ({ ...c, mode: mode.id as 'team' | 'athletes' | 'external-team' }))}
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
                    <div className="max-w-xs mx-auto">
                      <select 
                        value={comparisonConfig.externalTeam || ""}
                        onChange={(e) => setComparisonConfig(c => ({ ...c, externalTeam: e.target.value || undefined }))}
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
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? "border-teal-600 text-teal-600 bg-teal-50/30"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                }`}
              >
                <tab.Icon className="h-4 w-4" />
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

              {/* MATURITY OFFSET & TEAM COMPARISON SECTION */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                      {locale === 'es' ? 'Offset de maduración' : 'Maturity offset'}
                    </h3>
                  </div>
                  <div className="text-xs font-bold text-slate-400">
                    {teamAssessments.length} {t("analysis.individual.teammates")}
                  </div>
                </div>
                
                <div className="h-56 w-full relative">
                  <ResponsiveContainer width="99.9%" height={224} minWidth={0} debounce={100}>
                    <ComposedChart layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }} data={maturityOffsetChartData}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        domain={[
                          (dataMin: number) => Math.min(dataMin - 0.25, -0.25),
                          (dataMax: number) => Math.max(dataMax + 0.25, 0.25),
                        ]}
                      />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={132} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(val: any) => [formatNumber(Number(val), 2), t("datahub.offset")]} />
                      <ReferenceLine x={0} stroke="#94a3b8" strokeWidth={1.5} />
                      <Bar dataKey="offset" barSize={14} radius={5}>
                        {maturityOffsetChartData.map((entry, index) => {
                          const isPrimary = entry.athleteId === selectedAthleteId;
                          const isComparison = comparisonIds.includes(entry.athleteId);
                          return (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={isPrimary ? '#0d9488' : isComparison ? '#f59e0b' : '#e2e8f0'} 
                            />
                          );
                        })}
                      </Bar>
                    </ComposedChart>
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

              {/* APHV PREDICTION METHODS SECTION */}
              {selectedLatest && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-amber-600" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                        Moore APHV
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="text-center py-4">
                        <div className="text-4xl font-bold text-amber-600">{formatNumber(selectedLatest.methodOutputs.mooreAphv, 2)}</div>
                        <div className="text-xs text-slate-500 mt-1">{t("analysis.individual.years")}</div>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-1">
                        <div>{locale === 'es' ? 'Método: Regresión de Moore' : 'Method: Moore regression'}</div>
                        <div>{locale === 'es' ? 'Basado en antropometría y edad' : 'Based on anthropometry and age'}</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <Zap className="h-5 w-5 text-blue-600" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                        Mirwald APHV
                      </h3>
                    </div>
                    <div className="space-y-3">
                      <div className="text-center py-4">
                        <div className="text-4xl font-bold text-blue-600">{formatNumber(selectedLatest.methodOutputs.mirwaldAphv, 2)}</div>
                        <div className="text-xs text-slate-500 mt-1">{t("analysis.individual.years")}</div>
                      </div>
                      <div className="text-[11px] text-slate-500 space-y-1">
                        <div>{locale === 'es' ? 'Método: Ecuación de Mirwald' : 'Method: Mirwald equation'}</div>
                        <div>{locale === 'es' ? 'Basado en dimensiones corporales' : 'Based on body dimensions'}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* PAH (PROJECTED ADULT HEIGHT) SECTION */}
              {selectedLatest && selectedLatest.methodOutputs.pahCm && (
                <div className={`rounded-2xl border bg-white p-5 shadow-sm ${selectedLatest.inputs.sex === 'female' ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-slate-200'}`}>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-emerald-600" />
                      <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                        {locale === 'es' ? 'Altura adulta proyectada (Khamis-Roche)' : 'Projected adult height (Khamis-Roche)'}
                      </h3>
                    </div>
                    {selectedLatest.inputs.sex === 'female' && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">
                        {locale === 'es' ? 'Indicador principal ♀' : 'Primary indicator ♀'}
                      </span>
                    )}
                  </div>
                  {/* For girls: PAH% shown first and larger - more reliable than offset (Koziel & Malina 2018) */}
                  {selectedLatest.inputs.sex === 'female' && (
                    <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                      <div className="text-4xl font-bold text-emerald-600">{formatNumber(selectedLatest.methodOutputs.percentageAdultHeight, 1)}<span className="text-2xl">%</span></div>
                      <div className="text-xs text-emerald-700 font-medium mt-1">{locale === 'es' ? 'de la talla adulta estimada' : 'of predicted adult height'}</div>
                      <div className="mt-2 h-2.5 rounded-full bg-emerald-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, selectedLatest.methodOutputs.percentageAdultHeight ?? 0)}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-sm text-slate-500 mb-1">{locale === 'es' ? 'Altura actual' : 'Current height'}</div>
                      <div className="text-3xl font-bold text-slate-900">{formatNumber(selectedLatest.inputs.statureCm, 1)}</div>
                      <div className="text-xs text-slate-400">cm</div>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRight className="h-5 w-5 text-slate-300" />
                    </div>
                    <div className="text-center">
                      <div className="text-sm text-slate-500 mb-1">{locale === 'es' ? 'Talla adulta estimada' : 'Predicted adult height'}</div>
                      <div className="text-3xl font-bold text-emerald-600">{formatNumber(selectedLatest.methodOutputs.pahCm, 1)}</div>
                      <div className="text-xs text-slate-400">cm  <span className="text-slate-300">± 2.2 cm (50%)</span></div>
                    </div>
                  </div>
                  {selectedLatest.inputs.sex === 'male' && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{locale === 'es' ? 'Porcentaje de talla adulta' : 'Percentage of adult height'}</span>
                        <span className="font-bold text-emerald-600">{formatNumber(selectedLatest.methodOutputs.percentageAdultHeight, 1)}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, selectedLatest.methodOutputs.percentageAdultHeight ?? 0)}%` }} />
                      </div>
                    </div>
                  )}
                  {selectedLatest.inputs.sex === 'female' && (
                    <p className="mt-3 text-[11px] text-slate-400 italic">
                      {locale === 'es'
                        ? 'Para deportistas femeninas, el PAH% es el indicador más fiable. Las ecuaciones de offset tienen mayor sesgo en chicas (Koziel & Malina, 2018).'
                        : 'For female athletes, PAH% is the most reliable indicator. Offset equations show higher bias in girls (Koziel & Malina, 2018).'}
                    </p>
                  )}
                </div>
              )}

              {/* GROWTH VELOCITY SECTION */}
              {selectedLatest && selectedHistory.some(h => h.derivedMetrics.growthVelocityCmPerYear != null) && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-5 w-5 text-violet-600" />
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                      {t("maturationMethods.growthVelocityLabel")}
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div className="text-center p-3 bg-violet-50 rounded-xl">
                      <div className="text-xs text-slate-500 mb-1">{t("analysis.individual.latestMeasurement")}</div>
                      <div className="text-3xl font-bold text-violet-600">
                        {selectedLatest.derivedMetrics.growthVelocityCmPerYear != null
                          ? formatNumber(selectedLatest.derivedMetrics.growthVelocityCmPerYear, 1)
                          : '—'}
                      </div>
                      <div className="text-xs text-slate-400">{t("maturationMethods.growthVelocityUnit")}</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-xl">
                      <div className="text-xs text-slate-500 mb-1">{t("analysis.individual.phvReference")}</div>
                      <div className="text-3xl font-bold text-slate-400">
                        {selectedLatest.inputs.sex === 'male' ? '10.1' : '~8.3'}
                      </div>
                      <div className="text-xs text-slate-400">{t("maturationMethods.growthVelocityUnit")}</div>
                    </div>
                  </div>
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="99.9%" height={144} minWidth={0} debounce={100}>
                      <LineChart data={combinedHistory.filter(d => d.growthVelocity != null)}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} unit=" cm/a" width={52} />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          formatter={(val: any) => [`${val} ${t("maturationMethods.growthVelocityUnit")}`, t("maturationMethods.growthVelocityLabel")]}
                        />
                        <Line
                          type="monotone"
                          dataKey="growthVelocity"
                          stroke="#7c3aed"
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                          connectNulls={false}
                          name={`${t("maturationMethods.growthVelocityLabel")} (${t("maturationMethods.growthVelocityUnit")})`}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {t("maturationMethods.growthVelocityDesc")}
                  </p>
                </div>
              )}

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
                      {isComparisonTeamMode ? (
                        <Line
                          type="monotone"
                          dataKey="meanOffset"
                          stroke="#3b82f6"
                          strokeWidth={3}
                          strokeDasharray="5 5"
                          dot={false}
                          name={locale === 'es' ? 'Media del Equipo' : 'Team Mean'}
                        />
                      ) : (
                        comparisonHistories.map((ch, i) => (
                          <Line 
                            key={ch.id}
                            type="monotone" 
                            dataKey={ch.name} 
                            stroke={['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6'][i % 4]} 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ r: 3 }}
                          />
                        ))
                      )}
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

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-teal-600" />
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                    {locale === 'es' ? 'Línea de tiempo de maduración' : 'Maturation timeline'}
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[720px]">
                    <div className="flex items-center gap-4">
                      {maturationTimelinePoints.map((point) => (
                        <div key={point.date} className="flex-1 min-w-[160px]">
                          <div className="relative h-12">
                            <div className={`absolute left-1/2 top-1/2 h-2 w-full -translate-x-1/2 -translate-y-1/2 rounded-full ${
                              point.band === 'Pre-PHV' ? 'bg-teal-200' : point.band === 'Mid-PHV' ? 'bg-amber-200' : 'bg-slate-300'
                            }`} />
                            <div className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-5 w-5 rounded-full border-2 border-white shadow-sm ${
                              point.band === 'Pre-PHV' ? 'bg-teal-500' : point.band === 'Mid-PHV' ? 'bg-amber-500' : 'bg-slate-500'
                            }`} />
                          </div>
                          <div className="mt-4 text-center text-xs text-slate-500">
                            <div>{point.date}</div>
                            <div className="font-semibold text-slate-800">{point.band}</div>
                            <div>{formatNumber(point.offset, 2)} {t('datahub.offset')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

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
              {/* Test Type & Selection Filters */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">{locale === 'es' ? 'Tipo de test' : 'Test type'}</label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {performanceTestTypes.map((area) => {
                        const areaKey = area as PerformanceArea;
                        const selected = performanceTestAreas.includes(area);
                        const style = performanceAreaStyles[areaKey] ?? performanceAreaStyles.physical;
                        return (
                          <button
                            key={area}
                            onClick={() => {
                              const testsInArea = performanceTestsByArea[area] || [];
                              if (performanceTestAreas.includes(area)) {
                                setPerformanceTestAreas(performanceTestAreas.filter((a) => a !== area));
                                setPerformanceSelectedTests(performanceSelectedTests.filter((t) => !testsInArea.includes(t)));
                              } else {
                                setPerformanceTestAreas([...performanceTestAreas, area]);
                                setPerformanceSelectedTests([...performanceSelectedTests, ...testsInArea.filter((t) => !performanceSelectedTests.includes(t))]);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${selected ? style.chipActive : style.chipIdle}`}
                          >
                            {getAreaLabel(area)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {performanceTestAreas.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">{locale === 'es' ? 'Tests específicos' : 'Specific tests'}</label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {performanceTestAreas.flatMap((area) => performanceTestsByArea[area] || []).map((testName) => {
                          const definition = state.performanceDefinitions.find((test) => test.name === testName);
                          const areaKey = definition?.area ?? "physical";
                          const selected = performanceSelectedTests.includes(testName);
                          const style = performanceAreaStyles[areaKey] ?? performanceAreaStyles.physical;
                          return (
                            <button
                              key={testName}
                              onClick={() => {
                                if (performanceSelectedTests.includes(testName)) {
                                  setPerformanceSelectedTests(performanceSelectedTests.filter((t) => t !== testName));
                                } else {
                                  setPerformanceSelectedTests([...performanceSelectedTests, testName]);
                                }
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selected ? style.chipActive : style.chipIdle}`}
                            >
                              {testName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Performance Evolution */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Trophy className="h-5 w-5 text-teal-600" />
                  <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Evolucion de Rendimiento' : 'Performance Evolution'}</h3>
                </div>
                {filteredAthletePerformance.length > 0 ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredAthletePerformance.map(({ testName, latest, history, area }) => {
                      const style = performanceAreaStyles[area] ?? performanceAreaStyles.physical;
                      const color = performanceAreaChartColors[area] ?? performanceAreaChartColors.physical;
                      return (
                        <button
                          key={testName}
                          type="button"
                          title={locale === 'es' ? 'Ampliar grafico' : 'Expand chart'}
                          onClick={() => {
                            setExpandedPerformanceTestName(testName);
                            setExpandedPerformanceComparisonIds(
                              comparisonIds.filter((id) =>
                                state.performanceEntries.some((entry) => entry.athleteId === id && entry.testName === testName),
                              ),
                            );
                          }}
                          className={`group p-4 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 focus:outline-none focus:ring-2 transition-colors text-left ${style.ring}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="h-8 w-8 rounded-lg bg-white shadow-sm flex items-center justify-center">
                                <Target className={`h-4 w-4 ${style.icon}`} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-sm truncate max-w-[140px]">{testName}</div>
                                <div className={`text-[10px] font-semibold uppercase tracking-wider ${style.softText}`}>{getAreaLabel(area)}</div>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <div className={`font-bold ${style.softText}`}>{formatNumber(latest.value, 2)} {latest.unit}</div>
                              <div className="flex items-center justify-end gap-1 text-[10px] text-slate-400">
                                {formatDate(latest.measurementDate)}
                                <Maximize2 className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                              </div>
                            </div>
                          </div>
                          <div className="h-12 w-full mt-2 relative">
                            <ResponsiveContainer width="99.9%" height={48} minWidth={0} debounce={100}>
                              <LineChart data={history.map(h => ({ val: h.value }))}>
                                <Line type="monotone" dataKey="val" stroke={color} strokeWidth={2} dot={false} />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <Target className="h-12 w-12 mb-3 opacity-20" />
                    <p>{t("analysis.individual.noPerformance")}</p>
                  </div>
                )}
              </div>

              {performancePercentileStrips.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Shield className="h-5 w-5 text-slate-700" />
                    <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Rendimiento normalizado' : 'Performance percentiles'}</h3>
                  </div>
                  <div className="max-h-[360px] space-y-4 overflow-y-auto pr-2">
                    {performancePercentileStrips.map((strip, index) => {
                      const style = performanceAreaStyles[strip.area] ?? performanceAreaStyles.physical;
                      const showAreaHeader = index === 0 || performancePercentileStrips[index - 1].area !== strip.area;
                      return (
                      <div key={strip.testName} className={showAreaHeader ? "pt-1" : ""}>
                        {showAreaHeader && (
                          <div className={`mb-3 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${style.chipIdle}`}>
                            {getAreaLabel(strip.area)}
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-3 text-sm font-semibold">
                          <span className="min-w-0 truncate">{strip.testName}</span>
                          <span className={`shrink-0 ${style.softText}`}>{strip.percentile}º percentile</span>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.max(4, strip.percentile)}%`,
                              backgroundColor: performanceAreaChartColors[strip.area],
                            }}
                          />
                        </div>
                        <div className="mt-2 flex justify-between text-xs text-slate-500">
                          <span>{getAreaLabel(strip.area)}</span>
                          <span>{formatNumber(strip.min, 2)}-{formatNumber(strip.max, 2)} {strip.unit}</span>
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {false && filteredAthletePerformance.length > 0 && (
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
                            filteredAthletePerformance.flatMap(p => p.history.map(h => h.measurementDate))
                          )).sort();
                          
                          return allDates.map(date => {
                            const entry: any = { date: formatDate(date) };
                            filteredAthletePerformance.forEach(p => {
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
                        {filteredAthletePerformance.slice(0, 5).map((p, i) => (
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
              {performanceComparisonDotPlots.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex items-center gap-2 mb-6">
                    <Activity className="h-5 w-5 text-slate-700" />
                    <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Comparativa de Rendimiento' : 'Performance Comparison'}</h3>
                  </div>
                  <div className="space-y-8">
                    {performanceComparisonDotPlots.map((test) => {
                      const style = performanceAreaStyles[test.area] ?? performanceAreaStyles.physical;
                      const color = performanceAreaChartColors[test.area] ?? performanceAreaChartColors.physical;
                      return (
                      <div key={test.testName} className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-xs font-bold uppercase">
                          <span className="text-slate-500">{test.testName} ({test.unit})</span>
                          <span className={`rounded-full border px-2 py-0.5 normal-case ${style.chipIdle}`}>{getAreaLabel(test.area)}</span>
                        </div>
                        <div className="h-32 w-full relative">
                          <ResponsiveContainer width="99.9%" height={128} minWidth={0} debounce={100}>
                            <ScatterChart margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis
                                type="number"
                                dataKey="value"
                                domain={[(dataMin: number) => dataMin * 0.95, (dataMax: number) => dataMax * 1.05]}
                                tick={{ fontSize: 10 }}
                              />
                              <YAxis type="number" dataKey="y" hide />
                              <Tooltip
                                formatter={(value: any) => [formatNumber(Number(value), 2), test.testName]}
                                cursor={{ strokeDasharray: '3 3' }}
                              />
                              <Scatter data={test.points} fill={color}>
                                {test.points.map((point) => (
                                  <Cell
                                    key={point.athleteId}
                                    fill={point.isPrimary ? color : '#94a3b8'}
                                  />
                                ))}
                              </Scatter>
                            </ScatterChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
                          {test.points.map((point) => (
                            <span
                              key={point.athleteId}
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-1 ${point.isPrimary ? style.chipIdle : 'bg-slate-100 text-slate-500'}`}
                            >
                              {point.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {expandedPerformanceTest && selectedLatest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 no-print" role="dialog" aria-modal="true">
                  <button
                    type="button"
                    aria-label={locale === 'es' ? 'Cerrar grafico ampliado' : 'Close expanded chart'}
                    className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
                    onClick={() => {
                      setExpandedPerformanceTestName(null);
                      setExpandedPerformanceComparisonIds([]);
                    }}
                  />
                  <div className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
                    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${performanceAreaStyles[expandedPerformanceTest.area].softText}`}>
                          <TrendingUp className="h-4 w-4" />
                          {locale === 'es' ? 'Evolucion de Rendimiento' : 'Performance Evolution'}
                        </div>
                        <h3 className="mt-1 truncate text-2xl font-bold text-slate-900">{expandedPerformanceTest.testName}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedLatest.inputs.athleteName} - {getAreaLabel(expandedPerformanceTest.area)} - {expandedPerformanceTest.latest.unit}
                        </p>
                      </div>
                      <button
                        type="button"
                        aria-label={locale === 'es' ? 'Cerrar' : 'Close'}
                        onClick={() => {
                          setExpandedPerformanceTestName(null);
                          setExpandedPerformanceComparisonIds([]);
                        }}
                        className="self-end rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 sm:self-start"
                      >
                        <X className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="grid min-h-0 flex-1 gap-0 overflow-y-auto lg:grid-cols-[1fr_320px]">
                      <div className="min-h-[420px] p-5">
                        <div className="h-[420px] w-full">
                          <ResponsiveContainer width="99.9%" height={420} minWidth={0} debounce={100}>
                            <LineChart data={expandedPerformanceChartData} margin={{ top: 18, right: 28, left: 4, bottom: 8 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" fontSize={11} axisLine={false} tickLine={false} />
                              <YAxis fontSize={11} axisLine={false} tickLine={false} />
                              <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                formatter={(value) => [formatNumber(Number(value ?? 0), 2), expandedPerformanceTest.latest.unit]}
                              />
                              <Legend verticalAlign="top" align="right" iconType="circle" />
                              <Line
                                type="monotone"
                                dataKey="primary"
                                name={selectedLatest.inputs.athleteName}
                                stroke={performanceAreaChartColors[expandedPerformanceTest.area]}
                                strokeWidth={4}
                                dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                activeDot={{ r: 7, strokeWidth: 0 }}
                              />
                              {expandedPerformanceComparisons.map((comparison, index) => (
                                <Line
                                  key={comparison.id}
                                  type="monotone"
                                  dataKey={comparison.id}
                                  name={comparison.name}
                                  stroke={['#f59e0b', '#3b82f6', '#ec4899', '#8b5cf6', '#64748b'][index % 5]}
                                  strokeWidth={2}
                                  strokeDasharray="5 5"
                                  dot={{ r: 3 }}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <aside className="border-t border-slate-100 bg-slate-50/70 p-5 lg:border-l lg:border-t-0">
                        <div className="flex items-center justify-between gap-3">
                          <h4 className="text-sm font-bold text-slate-900">{locale === 'es' ? 'Comparaciones' : 'Comparisons'}</h4>
                          {expandedPerformanceComparisonIds.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setExpandedPerformanceComparisonIds([])}
                              className="text-xs font-bold text-teal-700 hover:text-teal-900"
                            >
                              {locale === 'es' ? 'Limpiar' : 'Clear'}
                            </button>
                          )}
                        </div>
                        {expandedPerformanceComparisonCandidates.length > 0 && (
                          <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3">
                            <select
                              value={expandedPerformanceTeamFilter}
                              onChange={(event) => setExpandedPerformanceTeamFilter(event.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
                            >
                              <option value="">{locale === 'es' ? 'Todos los equipos' : 'All teams'}</option>
                              {expandedPerformanceTeamOptions.map((team) => (
                                <option key={team} value={team}>{team}</option>
                              ))}
                            </select>
                            <select
                              value={expandedPerformancePositionFilter}
                              onChange={(event) => setExpandedPerformancePositionFilter(event.target.value)}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
                            >
                              <option value="">{locale === 'es' ? 'Todas las posiciones' : 'All positions'}</option>
                              {expandedPerformancePositionOptions.map((position) => (
                                <option key={position} value={position}>{position}</option>
                              ))}
                            </select>
                            <select
                              value={expandedPerformanceBandFilter}
                              onChange={(event) => setExpandedPerformanceBandFilter(event.target.value as MaturityBand | "")}
                              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
                            >
                              <option value="">{locale === 'es' ? 'Todos los grupos madurativos' : 'All maturity groups'}</option>
                              {expandedPerformanceBandOptions.map((band) => (
                                <option key={band} value={band}>{band}</option>
                              ))}
                            </select>
                            {(expandedPerformanceTeamFilter || expandedPerformancePositionFilter || expandedPerformanceBandFilter) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setExpandedPerformanceTeamFilter("");
                                  setExpandedPerformancePositionFilter("");
                                  setExpandedPerformanceBandFilter("");
                                }}
                                className="w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
                              >
                                {locale === 'es' ? 'Reiniciar filtros' : 'Reset filters'}
                              </button>
                            )}
                          </div>
                        )}
                        <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
                          {filteredExpandedPerformanceComparisonCandidates.length > 0 ? (
                            filteredExpandedPerformanceComparisonCandidates.map((candidate) => {
                              const selected = expandedPerformanceComparisonIds.includes(candidate.athleteId);
                              return (
                                <button
                                  key={candidate.athleteId}
                                  type="button"
                                  onClick={() => {
                                    setExpandedPerformanceComparisonIds((current) =>
                                      current.includes(candidate.athleteId)
                                        ? current.filter((id) => id !== candidate.athleteId)
                                        : [...current, candidate.athleteId],
                                    );
                                  }}
                                  className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition ${
                                    selected
                                      ? 'border-amber-300 bg-amber-50 text-amber-800'
                                      : 'border-slate-200 bg-white text-slate-700 hover:border-teal-200'
                                  }`}
                                >
                                  <span className="min-w-0">
                                    <span className="block truncate text-sm font-bold">{candidate.name}</span>
                                    <span className="block truncate text-xs text-slate-500">
                                      {[candidate.teamName, candidate.position, candidate.maturityBand].filter(Boolean).join(" · ")}
                                    </span>
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2 text-xs font-bold">
                                    {formatNumber(candidate.value, 2)} {candidate.unit}
                                    {selected && <CheckCircle2 className="h-4 w-4" />}
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                              {expandedPerformanceComparisonCandidates.length > 0
                                ? (locale === 'es' ? 'No hay jugadores con esos filtros.' : 'No athletes match those filters.')
                                : (locale === 'es' ? 'No hay otros jugadores con este test.' : 'No other athletes have this test.')}
                            </div>
                          )}
                        </div>
                      </aside>
                    </div>
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
                        <AreaChart data={athleteLoadTrend} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                          <YAxis fontSize={10} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(value: any, name: any) => [formatNumber(Number(value), 1), name]} />
                          <Legend verticalAlign="top" align="right" />
                          <Area type="monotone" dataKey="chronic" name={locale === 'es' ? 'Carga Crónica' : 'Chronic Load'} stroke="#3b82f6" fill="#bfdbfe" fillOpacity={0.6} />
                          <Area type="monotone" dataKey="acute" name={locale === 'es' ? 'Carga Aguda' : 'Acute Load'} stroke="#f59e0b" fill="#fde68a" fillOpacity={0.7} />
                        </AreaChart>
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
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
  locale: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const teams = useMemo(
    () => getUniqueAthleteTeams(state.athletes),
    [state.athletes],
  );

  const [selectedTeam, setSelectedTeam] = usePersistentState<string>(
    "analysis_collective_team",
    teams[0] ?? ""
  );

  // Initialize with the first team if none has been persisted yet
  useEffect(() => {
    if (!selectedTeam && teams.length > 0) {
      setSelectedTeam(teams[0]);
    }
  }, [teams, selectedTeam, setSelectedTeam]);

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
    ? [{
        name: selectedTeam,
        "Pre-PHV": teamStats.bandCounts["Pre-PHV"],
        "Mid-PHV": teamStats.bandCounts["Mid-PHV"],
        "Post-PHV": teamStats.bandCounts["Post-PHV"],
      }]
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

  const maturityScatterData = teamStats
    ? teamStats.athletes.map((a) => ({
        age: Number(a.derivedMetrics.chronologicalAge.toFixed(2)),
        offset: Number(a.classification.primaryOffset.toFixed(2)),
        name: a.inputs.athleteName,
        band: a.classification.maturityBand,
      }))
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
                  <BarChart layout="vertical" data={distributionData} margin={{ left: 24, right: 24 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" hide />
                    <Tooltip formatter={(val: any) => [formatNumber(Number(val), 0), t("analysisExtra.count")]} />
                    <Legend />
                    <Bar dataKey="Pre-PHV" stackId="a" fill={bandColors["Pre-PHV"]} />
                    <Bar dataKey="Mid-PHV" stackId="a" fill={bandColors["Mid-PHV"]} />
                    <Bar dataKey="Post-PHV" stackId="a" fill={bandColors["Post-PHV"]} />
                  </BarChart>
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
          </div>

          <div className="panel rounded-[1.75rem] p-6">
            <h2 className="mb-4 text-lg font-semibold">{locale === 'es' ? 'Edad cronológica vs Offset PHV' : 'Chronological age vs PHV offset'}</h2>
            <div className="h-72 w-full relative">
              <ResponsiveContainer width="99.9%" height={288} minWidth={0} debounce={100}>
                <ScatterChart margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="age" type="number" tick={{ fontSize: 10 }} unit={locale === 'es' ? 'años' : 'yrs'} name={locale === 'es' ? 'Edad' : 'Age'} />
                  <YAxis dataKey="offset" type="number" tick={{ fontSize: 10 }} name={t("datahub.offset")} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(value: any) => [formatNumber(Number(value), 2), '']} />
                  <Scatter data={maturityScatterData}>
                    {maturityScatterData.map((entry, idx) => (
                      <Cell key={`scatter-${idx}`} fill={bandColors[entry.band as keyof typeof bandColors]} />
                    ))}
                  </Scatter>
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="panel rounded-[1.75rem] p-6">
              <h2 className="mb-4 text-lg font-semibold">{t("analysis.collective.psychologicalProfile")}</h2>
              <div className="h-64 w-full relative">
                {teamStats.psychScores.length > 0 ? (
                  <ResponsiveContainer width="99.9%" height={256} minWidth={0} debounce={100}>
                    <BarChart layout="vertical" data={teamStats.psychScores} margin={{ left: 120, right: 16 }}>
                      <XAxis type="number" domain={[0, 10]} hide />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} width={120} />
                      <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(15, 23, 42, 0.08)" />
                      <Tooltip formatter={(val: any) => [formatNumber(Number(val), 2), t("analysis.collective.teamMean")]} />
                      <Bar dataKey="value" fill="#0f766e" radius={[0, 4, 4, 0]} barSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                    {t("analysis.collective.noPsychological")}
                  </div>
                )}
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
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
  locale: string;
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
          className="group flex flex-col items-start p-8 bg-white rounded-2xl border border-slate-200 shadow-sm hover:-translate-y-1 hover:shadow-lg transition-all text-left"
        >
          <div className={`p-4 rounded-2xl mb-6 transition-transform group-hover:scale-105 ${opt.color}`}>
            {opt.icon}
          </div>
          <h3 className="text-xl font-bold text-slate-900 mb-3">
            {t(`analysis.tabs.${opt.id}`)}
          </h3>
          <p className="text-slate-500 leading-relaxed">
            {opt.desc}
          </p>
          <div className="mt-8 flex items-center gap-2 text-sm font-bold text-slate-900 group-hover:translate-x-1 transition-transform">
            {t("common.open") || "Entrar"}
            <ArrowLeft className="h-4 w-4 rotate-180" />
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Analysis Sidebar
// ---------------------------------------------------------------------------
function AnalysisSidebar({
  activeTab,
  onSelect,
  t,
}: {
  activeTab: AnalysisTab | null;
  onSelect: (tab: AnalysisTab | null) => void;
  t: (k: string) => string;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const items: { id: AnalysisTab; icon: React.ReactNode }[] = [
    { id: "individual", icon: <Users className="h-5 w-5 flex-shrink-0" /> },
    { id: "collective", icon: <Group className="h-5 w-5 flex-shrink-0" /> },
    { id: "assistant", icon: <Activity className="h-5 w-5 flex-shrink-0" /> },
  ];

  function handleSelect(tab: AnalysisTab) {
    onSelect(tab);
    setMobileOpen(false);
  }

  const navItems = (
    <div className="p-2 space-y-1">
      <button
        type="button"
        onClick={() => { setCollapsed((p) => !p); setMobileOpen(false); }}
        className="hidden md:flex w-full items-center justify-center rounded-xl px-2 py-3 text-slate-500 hover:bg-slate-100 transition"
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="border-t border-slate-200 pt-2">
        {items.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              title={collapsed ? t(`analysis.tabs.${item.id}`) : undefined}
              className={cn(
                "w-full flex items-center rounded-xl py-3 text-sm font-medium transition",
                collapsed ? "justify-center px-2" : "gap-3 px-4",
                active ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100",
              )}
            >
              {item.icon}
              {!collapsed && <span>{t(`analysis.tabs.${item.id}`)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile FAB trigger — hidden on landing */}
      {activeTab !== null && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed bottom-4 right-4 z-40 flex items-center justify-center w-12 h-12 rounded-full bg-teal-600 text-white shadow-lg active:scale-95 transition"
          aria-label="Abrir navegación"
        >
          <Menu className="h-5 w-5" />
        </button>
      )}

      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-40"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <div
        className={cn(
          "md:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl border-r border-slate-200 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        aria-hidden={!mobileOpen}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-700">{t("nav.analysis") || "Análisis"}</span>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {items.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition",
                  active ? "bg-teal-600 text-white" : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {item.icon}
                <span>{t(`analysis.tabs.${item.id}`)}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Desktop sidebar */}
      <nav
        className={cn(
          "hidden md:flex flex-col border-r border-slate-200 bg-white/95 flex-shrink-0 transition-all duration-200 ease-in-out",
          collapsed ? "w-14" : "w-56",
        )}
        aria-label="Analysis sections"
      >
        {navItems}
      </nav>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main Analysis Page
// ---------------------------------------------------------------------------
export default function AnalysisPage() {
  const { assessments, state } = useAppState();
  const { t, locale } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryTab = searchParams.get("tab");
  const initialTab: AnalysisTab | null =
    queryTab === "individual" || queryTab === "collective" || queryTab === "assistant"
      ? queryTab
      : null;
  const [activeTab, setActiveTab] = useState<AnalysisTab | null>(initialTab);

  useEffect(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab === "individual" || queryTab === "collective" || queryTab === "assistant") {
      setActiveTab(queryTab);
    } else {
      setActiveTab(null);
    }
  }, [searchParams]);

  // Reset transient workspace selection when navigating away from the Analysis module completely
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("analysis_indiv_compare");
        sessionStorage.removeItem("analysis_indiv_comp_config");
        sessionStorage.removeItem("analysis_indiv_comp_panel");
        sessionStorage.removeItem("analysis_indiv_subtab");
        sessionStorage.removeItem("analysis_indiv_perf_areas");
        sessionStorage.removeItem("analysis_indiv_perf_tests");
        sessionStorage.removeItem("analysis_collective_team");
      }
    };
  }, []);

  // Clear sub-area selections only when transitioning between sub-tabs inside Analysis.
  // This does not clear on initial load/refresh because prevTab starts as null.
  const prevTabRef = useRef<string | null>(null);
  useEffect(() => {
    const currentTab = activeTab;
    const prevTab = prevTabRef.current;
    
    if (prevTab !== null && prevTab !== currentTab) {
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("analysis_indiv_compare");
        sessionStorage.removeItem("analysis_indiv_comp_config");
        sessionStorage.removeItem("analysis_indiv_comp_panel");
        sessionStorage.removeItem("analysis_indiv_subtab");
        sessionStorage.removeItem("analysis_indiv_perf_areas");
        sessionStorage.removeItem("analysis_indiv_perf_tests");
        sessionStorage.removeItem("analysis_collective_team");
      }
    }
    prevTabRef.current = currentTab;
  }, [activeTab]);

  const handleSelectTab = (tab: AnalysisTab | null) => {
    setActiveTab(tab);
    if (tab) {
      router.replace(`/analysis?tab=${tab}`, { scroll: false });
    } else {
      router.replace(`/analysis`, { scroll: false });
    }
  };

  const tabLabels: Record<AnalysisTab, string> = {
    individual: t("analysis.tabs.individual"),
    collective: t("analysis.tabs.collective"),
    assistant: t("analysis.tabs.assistant"),
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full min-w-0">
      {activeTab !== null && (
        <AnalysisSidebar activeTab={activeTab} onSelect={handleSelectTab} t={t} />
      )}
      <div className="min-w-0 flex-1 bg-[#f8fafc] p-4 sm:p-6 md:p-8 overflow-x-hidden">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                {activeTab ? t(`analysis.tabTitle${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`) : t("analysis.title")}
              </h1>
              <p className="mt-1 text-slate-500">
                {activeTab ? t(`analysis.tabSubtitle${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`) : t("analysis.subtitle")}
              </p>
            </div>
          </header>

          {!activeTab && (
            <AnalysisSelection onSelect={handleSelectTab} t={t} locale={locale} />
          )}

          <div className="mt-6">
            {activeTab === "individual" && (
              <IndividualView assessments={assessments} state={state} t={t} locale={locale} />
            )}
            {activeTab === "collective" && (
              <CollectiveView assessments={assessments} state={state} t={t} locale={locale} />
            )}
            {activeTab === "assistant" && (
              <AssistantView assessments={assessments} state={state} t={t} locale={locale} />
            )}
          </div>
        </div>
      </div>

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