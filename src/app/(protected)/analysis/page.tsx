"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, LineChart, ResponsiveContainer,
  ReferenceLine, Scatter, ScatterChart, Tooltip, XAxis, YAxis, Legend,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import {
  AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Filter,
  Search, TrendingUp, Users, Calendar, MapPin, Target,
  Dumbbell, Shield, Activity, Group, Trophy, Zap, Download,
  ArrowLeft, ArrowRight, Info, X, Menu, Maximize2, BarChart2
} from "lucide-react";
import { buildInsights } from "@/lib/maturation/insights";
import { useAppState } from "@/lib/store/app-state";
import { useLocale } from "@/lib/i18n/locale-context";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { usePersistentState } from "@/lib/hooks/use-persistent-state";
import { useMaturationPreferences } from "@/lib/hooks/use-maturation-preferences";
import { MaturationInsights } from "@/components/maturation-insights";
import {
  buildAlerts, detectRapidGrowth,
} from "@/lib/maturation/analysis-helpers";
import {
  getAssessmentsForTeam,
  getLatestAssessmentsByAthlete,
  getUniqueAthleteTeams,
} from "@/lib/maturation/selectors";
import { createUnifiedProfile, getGroupingBand } from "@/lib/maturation/unified-maturation";
import type { MaturityBand, PerformanceArea, TrainingLoadEntry, PerformanceEntry, MaturationResult, Sex, GpsSession } from "@/lib/types";
import type { AlertItem } from "@/lib/maturation/analysis-helpers";

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
// ---------------------------------------------------------------------------
// Module-level helper — resolves sex from the athletes roster.
// Shared by IndividualView, CollectiveView and AssistantView.
// ---------------------------------------------------------------------------
function resolveAssessmentSex(
  assessment: MaturationResult,
  athletes: ReturnType<typeof useAppState>["state"]["athletes"],
): Sex {
  const athlete = athletes.find(
    (candidate) =>
      candidate.id === assessment.inputs.athleteId ||
      (
        candidate.name.toLowerCase() === assessment.inputs.athleteName.toLowerCase() &&
        candidate.dob === assessment.inputs.dob
      ),
  );
  return athlete?.sex === "female" ? "female" : "male";
}

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
  const {
    selectedEngine,
    bioBandingStrategy,
  } = useMaturationPreferences();
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

  const getAssessmentSex = (assessment: MaturationResult): Sex =>
    resolveAssessmentSex(assessment, state.athletes);

  const latestByAthlete = useMemo(
    () => getLatestAssessmentsByAthlete(assessments).map((assessment) => {
      const athleteSex = getAssessmentSex(assessment);
      const profile = createUnifiedProfile(assessment, selectedEngine, bioBandingStrategy, athleteSex);
      return {
        ...assessment,
        classification: {
          ...assessment.classification,
          maturityBand: getGroupingBand(profile),
          primaryOffset: profile.offset ?? assessment.classification.primaryOffset,
        },
      };
    }),
    [assessments, selectedEngine, bioBandingStrategy, state.athletes],
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

  const selectedLatestProfile = useMemo(() => {
    if (!selectedLatest) return null;
    const athleteSex = getAssessmentSex(selectedLatest);
    return createUnifiedProfile(selectedLatest, selectedEngine, bioBandingStrategy, athleteSex);
  }, [selectedLatest, selectedEngine, bioBandingStrategy, state.athletes]);

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
    () => {
      const selectedSex = selectedLatest ? getAssessmentSex(selectedLatest) : undefined;
      return teamAssessments
        .map((assessment) => {
          const aSex = getAssessmentSex(assessment);
          const aProfile = createUnifiedProfile(assessment, selectedEngine, bioBandingStrategy, aSex);
          return {
            athleteId: assessment.inputs.athleteId,
            name: assessment.inputs.athleteName,
            offset: aProfile.offset != null ? Number(aProfile.offset.toFixed(2)) : null,
          };
        })
        .filter((d) => d.offset !== null)
        .sort((a, b) => (b.offset as number) - (a.offset as number));
    },
    [teamAssessments, selectedEngine, bioBandingStrategy],
  );

  const combinedHistory = useMemo(() => {
    if (!selectedLatest) return [];
    const dates = new Set<string>();
    selectedHistory.forEach(h => dates.add(h.inputs.dataCollectionDate));
    comparisonHistories.forEach(ch => {
      ch.history.forEach(h => dates.add(h.inputs.dataCollectionDate));
    });

    const selectedSex = getAssessmentSex(selectedLatest);

    return Array.from(dates).sort().map(date => {
      const entry: any = { date: formatDate(date) };
      const values: number[] = [];
      const primaryMatch = selectedHistory.find(h => h.inputs.dataCollectionDate === date);
      if (primaryMatch) {
        const primaryProfile = createUnifiedProfile(primaryMatch, selectedEngine, bioBandingStrategy, selectedSex);
        const value = Number((primaryProfile.offset ?? primaryMatch.classification.primaryOffset).toFixed(2));
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
          const compAthleteLatest = activeComparisonAthletes.find(a => a.inputs.athleteId === ch.id);
          const compSex = compAthleteLatest ? getAssessmentSex(compAthleteLatest) : selectedSex;
          const compProfile = createUnifiedProfile(match, selectedEngine, bioBandingStrategy, compSex);
          const value = Number((compProfile.offset ?? match.classification.primaryOffset).toFixed(2));
          entry[ch.name] = value;
          values.push(value);
        }
      });
      if (isComparisonTeamMode) {
        entry.meanOffset = values.length ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(2)) : null;
      }
      return entry;
    });
  }, [selectedHistory, comparisonHistories, selectedLatest, isComparisonTeamMode, selectedEngine, bioBandingStrategy, activeComparisonAthletes]);

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

  // CHANGE 1 FIX: Renamed inner variable from `latestByAthlete` to `latestEntryByAthlete`
  // to avoid shadowing the outer `latestByAthlete` (MaturationResult[]) which caused
  // TypeScript to infer the wrong type and report "Property 'chronologicalAge' does not exist
  // on type 'AnthropometricRecord'" (TS2339).
  const performancePercentileStrips = useMemo(() => {
    if (!selectedLatest || filteredAthletePerformance.length === 0) return [];
    const comparisonAthleteIds = new Set([selectedLatest.inputs.athleteId, ...comparisonLatest.map(a => a.inputs.athleteId)]);

    return filteredAthletePerformance.map((test) => {
      const latestEntryByAthlete = state.performanceEntries
        .filter((e) => e.testName === test.testName && comparisonAthleteIds.has(e.athleteId))
        .reduce<Record<string, PerformanceEntry>>((acc, e) => {
          const existing = acc[e.athleteId];
          if (!existing || e.measurementDate > existing.measurementDate) {
            acc[e.athleteId] = e;
          }
          return acc;
        }, {});

      const values = Object.values(latestEntryByAthlete).map((e) => e.value).sort((a, b) => a - b);
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

  // Normalised column accessor — matches regardless of newlines / extra spaces in column names
  const colVal = (row: Record<string, string | number>, key: string): number | undefined => {
    const norm = (s: string) => s.replace(/\s*\n\s*/g, " ").replace(/\s{2,}/g, " ").trim();
    const normKey = norm(key);
    const found = Object.keys(row).find(k => norm(k) === normKey);
    if (!found) return undefined;
    const v = Number(row[found]);
    return isNaN(v) ? undefined : v;
  };

  // GPS sessions for selected athlete (from rawRows._athleteId)
  const athleteGpsSessions = useMemo(() => {
    if (!selectedAthleteId) return [];
    return (state.gpsSessions ?? [])
      .filter(s => s.rawRows.some(r => String(r._athleteId) === selectedAthleteId))
      .map(s => {
        const row = s.rawRows.find(r => String(r._athleteId) === selectedAthleteId);
        return { session: s, row: row ?? {} };
      })
      .sort((a, b) => a.session.date.localeCompare(b.session.date));
  }, [state.gpsSessions, selectedAthleteId]);

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
                <p className="text-xs text-slate-500">{selectedLatest.inputs.teamName} · {selectedLatest.classification.maturityBand ?? "—"}</p>
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
                profile={selectedLatestProfile}
                zScore={zScoreInfo ? { score: zScoreInfo.score, label: zScoreInfo.label } : undefined}
                baselineLabel={currentBaseline.label}
              />



              {/* MATURITY OFFSET & TEAM COMPARISON SECTION */}
              {/* CHANGE 2: Removed teammate count from top-right of chart header */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-teal-600" />
                    <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                      {locale === 'es' ? 'Offset de maduración' : 'Maturity offset'}
                    </h3>
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
                      <YAxis type="category" dataKey="name" tick={false} width={8} axisLine={false} tickLine={false} />
                      <Tooltip 
                        formatter={(val: any, _name: any, props: any) => [formatNumber(Number(val), 2), props?.payload?.name || t("datahub.offset")]} 
                        labelFormatter={() => ''}
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      />
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
                      <span className="font-medium text-slate-400">{locale === 'es' ? 'Compañeros de Equipo' : t("analysis.individual.teammates")}</span>
                    </div>
                  </div>
                  <div className="font-bold text-teal-600">
                    {t("analysis.individual.zScoreLabel")}: {zScoreInfo?.score.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* GRÁFICO 2: EVOLUCIÓN TEMPORAL */}
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

              {/* GRÁFICO 3: DIAGRAMA DE FASES DE MADURACIÓN */}
              {selectedLatest && selectedLatestProfile && (
                (() => {
                  const usesPAH = selectedLatestProfile.bioBandingStrategy === 'pah';
                  const aphv = selectedLatestProfile.aphv;
                  const chronoAge = selectedLatest.derivedMetrics.chronologicalAge;
                  const offset = selectedLatestProfile.offset;
                  const currentBand = selectedLatestProfile.maturityBand;

                  if (usesPAH) {
                    // PAH mode: show PAH% bands
                    const pahPct = selectedLatestProfile.pahPercentage ?? selectedLatest.methodOutputs.percentageAdultHeight ?? null;
                    const prePahMax = 85;
                    const midPahMin = 85;
                    const midPahMax = 95;
                    const postPahMin = 95;

                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-2 mb-4">
                          <Activity className="h-5 w-5 text-teal-600" />
                          <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                            {locale === 'es' ? 'Posición en fases de maduración (% PAH)' : 'Maturation phase position (% PAH)'}
                          </h3>
                        </div>
                        {pahPct !== null ? (
                          <div className="space-y-4">
                            <div className="relative h-14 rounded-xl overflow-hidden flex">
                              {/* Pre-PHV */}
                              <div className="flex-[85] bg-teal-100 flex items-center justify-center text-[10px] font-bold text-teal-700 border-r border-white/60">Pre-PHV (&lt;85%)</div>
                              {/* Mid-PHV */}
                              <div className="flex-[10] bg-amber-100 flex items-center justify-center text-[10px] font-bold text-amber-700 border-r border-white/60">Mid</div>
                              {/* Post-PHV */}
                              <div className="flex-[5] bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">Post</div>
                            </div>
                            {/* Marker */}
                            <div className="relative h-6">
                              <div
                                className="absolute -translate-x-1/2 flex flex-col items-center"
                                style={{ left: `${Math.min(99, Math.max(1, pahPct))}%` }}
                              >
                                <div className="w-3 h-3 rounded-full bg-slate-900 border-2 border-white shadow-md" />
                                <span className="text-[10px] font-bold text-slate-800 mt-0.5 whitespace-nowrap">{pahPct.toFixed(1)}%</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2 text-center text-[11px]">
                              <div className={`p-2 rounded-xl ${currentBand === 'Pre-PHV' ? 'bg-teal-100 text-teal-800 font-bold ring-2 ring-teal-400' : 'text-slate-400'}`}>Pre-PHV<br/>&lt; 85%</div>
                              <div className={`p-2 rounded-xl ${currentBand === 'Mid-PHV' ? 'bg-amber-100 text-amber-800 font-bold ring-2 ring-amber-400' : 'text-slate-400'}`}>Mid-PHV<br/>85–95%</div>
                              <div className={`p-2 rounded-xl ${currentBand === 'Post-PHV' ? 'bg-slate-200 text-slate-800 font-bold ring-2 ring-slate-400' : 'text-slate-400'}`}>Post-PHV<br/>&gt; 95%</div>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-slate-400 italic">{locale === 'es' ? 'Datos de % PAH no disponibles.' : '% PAH data not available.'}</p>
                        )}
                      </div>
                    );
                  }

                  // OFFSET mode: show PHV timeline with Pre / Mid (-1 to +1) / Post
                  if (aphv === null || offset === null) {
                    return (
                      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                        <p className="text-sm text-slate-400 italic">{locale === 'es' ? 'APHV no disponible para este método.' : 'APHV not available for this method.'}</p>
                      </div>
                    );
                  }

                  // Chronological age at each phase boundary
                  const aphvAge = aphv;
                  const midStart = aphvAge - 1;
                  const midEnd = aphvAge + 1;
                  // Display range: 2 years before Mid-start to 2 years after Mid-end
                  const displayMin = midStart - 2;
                  const displayMax = midEnd + 2;
                  const totalRange = displayMax - displayMin;

                  const toPercent = (age: number) => Math.min(100, Math.max(0, ((age - displayMin) / totalRange) * 100));

                  const prePct = toPercent(midStart);
                  const midPct = toPercent(midEnd);
                  const currentAgeForDisplay = chronoAge ?? (aphvAge + offset);
                  const currentPct = toPercent(currentAgeForDisplay);

                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <Activity className="h-5 w-5 text-teal-600" />
                        <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                          {locale === 'es' ? 'Posición en el continuo de maduración (APHV)' : 'Position in maturation continuum (APHV)'}
                        </h3>
                      </div>
                      <div className="space-y-3">
                        {/* Phase bar with player position overlay */}
                        <div className="relative">
                          {/* Phase colour bar */}
                          <div className="relative h-10 rounded-xl overflow-hidden flex">
                            <div style={{ width: `${prePct}%` }} className="bg-teal-100 flex items-center justify-center text-[9px] font-bold text-teal-700 shrink-0">
                              {prePct > 12 ? 'Pre-PHV' : ''}
                            </div>
                            <div style={{ width: `${midPct - prePct}%` }} className="bg-amber-100 flex items-center justify-center text-[9px] font-bold text-amber-700 shrink-0">
                              Mid-PHV
                            </div>
                            <div style={{ width: `${100 - midPct}%` }} className="bg-slate-200 flex items-center justify-center text-[9px] font-bold text-slate-600 shrink-0">
                              {(100 - midPct) > 10 ? 'Post-PHV' : ''}
                            </div>
                          </div>
                          {/* CHANGE 3: Vertical line overlay at player's current position */}
                          <div
                            className="absolute top-0 bottom-0 w-0.5 bg-slate-900 shadow-md pointer-events-none"
                            style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
                          />
                        </div>

                        {/* Age labels beneath bar */}
                        <div className="relative h-5">
                          <span className="absolute text-[9px] text-slate-500" style={{ left: `${prePct}%`, transform: 'translateX(-50%)' }}>
                            {midStart.toFixed(1)} {locale === 'es' ? 'a' : 'y'}
                          </span>
                          <span className="absolute text-[9px] text-amber-600 font-bold" style={{ left: '50%', transform: 'translateX(-50%)' }}>
                            APHV {aphvAge.toFixed(1)} {locale === 'es' ? 'a' : 'y'}
                          </span>
                          <span className="absolute text-[9px] text-slate-500" style={{ left: `${midPct}%`, transform: 'translateX(-50%)' }}>
                            {midEnd.toFixed(1)} {locale === 'es' ? 'a' : 'y'}
                          </span>
                        </div>

                        {/* Current player marker dot + label */}
                        <div className="relative h-8 mt-1">
                          <div
                            className="absolute -translate-x-1/2 flex flex-col items-center"
                            style={{ left: `${currentPct}%` }}
                          >
                            <div className="w-4 h-4 rounded-full bg-slate-900 border-2 border-white shadow-md" />
                            <span className="text-[10px] font-bold text-slate-800 mt-0.5 whitespace-nowrap">
                              {currentAgeForDisplay.toFixed(1)} {locale === 'es' ? 'a' : 'y'}
                            </span>
                          </div>
                        </div>

                        {/* Band pills */}
                        <div className="grid grid-cols-3 gap-2 text-center text-[11px] mt-2">
                          <div className={`p-2 rounded-xl ${currentBand === 'Pre-PHV' ? 'bg-teal-100 text-teal-800 font-bold ring-2 ring-teal-400' : 'text-slate-400'}`}>
                            Pre-PHV<br/><span className="text-[10px]">{locale === 'es' ? `< ${midStart.toFixed(1)} a` : `< ${midStart.toFixed(1)} y`}</span>
                          </div>
                          <div className={`p-2 rounded-xl ${currentBand === 'Mid-PHV' ? 'bg-amber-100 text-amber-800 font-bold ring-2 ring-amber-400' : 'text-slate-400'}`}>
                            Mid-PHV<br/><span className="text-[10px]">{locale === 'es' ? `±1 APHV (${midStart.toFixed(1)}–${midEnd.toFixed(1)} a)` : `±1 APHV (${midStart.toFixed(1)}–${midEnd.toFixed(1)} y)`}</span>
                          </div>
                          <div className={`p-2 rounded-xl ${currentBand === 'Post-PHV' ? 'bg-slate-200 text-slate-800 font-bold ring-2 ring-slate-400' : 'text-slate-400'}`}>
                            Post-PHV<br/><span className="text-[10px]">{locale === 'es' ? `> ${midEnd.toFixed(1)} a` : `> ${midEnd.toFixed(1)} y`}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}



              {/* PAH (PROJECTED ADULT HEIGHT) SECTION */}
              {selectedLatest && (selectedLatestProfile?.pah !== null || selectedLatest.methodOutputs.pahCm) && (
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
                      <div className="text-4xl font-bold text-emerald-600">{formatNumber(selectedLatestProfile?.pahPercentage ?? selectedLatest.methodOutputs.percentageAdultHeight, 1)}<span className="text-2xl">%</span></div>
                      <div className="text-xs text-emerald-700 font-medium mt-1">{locale === 'es' ? 'de la talla adulta estimada' : 'of predicted adult height'}</div>
                      <div className="mt-2 h-2.5 rounded-full bg-emerald-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, selectedLatestProfile?.pahPercentage ?? selectedLatest.methodOutputs.percentageAdultHeight ?? 0)}%` }} />
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
                      <div className="text-3xl font-bold text-emerald-600">{formatNumber(selectedLatestProfile?.pah ?? selectedLatest.methodOutputs.pahCm ?? 0, 1)}</div>
                      <div className="text-xs text-slate-400">cm  <span className="text-slate-300">± 2.2 cm (50%)</span></div>
                    </div>
                  </div>
                  {selectedLatest.inputs.sex === 'male' && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">{locale === 'es' ? 'Porcentaje de talla adulta' : 'Percentage of adult height'}</span>
                        <span className="font-bold text-emerald-600">{formatNumber(selectedLatestProfile?.pahPercentage ?? selectedLatest.methodOutputs.percentageAdultHeight, 1)}%</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, selectedLatestProfile?.pahPercentage ?? selectedLatest.methodOutputs.percentageAdultHeight ?? 0)}%` }} />
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
              {/* CHANGE 4: Chart now shows stature evolution (cm) instead of velocity.
                  The two KPI cards remain (latest velocity + PHV reference).
                  The description text below the chart has been removed. */}
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
                      <div className="text-3xl font-bold text-violet-600" suppressHydrationWarning>
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
                  {/* Stature evolution chart (cm over time) */}
                  <div className="h-36 w-full">
                    <ResponsiveContainer width="99.9%" height={144} minWidth={0} debounce={100}>
                      <LineChart data={combinedHistory}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis
                          fontSize={10}
                          axisLine={false}
                          tickLine={false}
                          unit=" cm"
                          width={52}
                          domain={['auto', 'auto']}
                        />
                        <Tooltip
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                          formatter={(val: any) => [`${val} cm`, locale === 'es' ? 'Estatura' : 'Stature']}
                        />
                        <Line
                          type="monotone"
                          dataKey="stature"
                          stroke="#7c3aed"
                          strokeWidth={3}
                          dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                          connectNulls={false}
                          name={locale === 'es' ? 'Estatura (cm)' : 'Stature (cm)'}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

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
                        {[selectedLatest, ...comparisonLatest].filter(Boolean).map((a: any) => {
                          const aSex = getAssessmentSex(a);
                          const aProfile = createUnifiedProfile(a, selectedEngine, bioBandingStrategy, aSex);
                          return (
                          <tr key={a.inputs.athleteId} className={a.inputs.athleteId === selectedAthleteId ? "bg-teal-50/30" : ""}>
                            <td className="px-6 py-4 font-bold">{a.inputs.athleteName}</td>
                            <td className="px-6 py-4 font-bold text-teal-600">{aProfile.offset != null ? formatNumber(aProfile.offset, 2) : "—"}</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                aProfile.maturityBand === "Pre-PHV" ? "bg-teal-100 text-teal-700" :
                                aProfile.maturityBand === "Mid-PHV" ? "bg-amber-100 text-amber-700" :
                                "bg-slate-200 text-slate-700"
                              }`}>
                                {aProfile.maturityBand ?? "—"}
                              </span>
                            </td>
                            <td className="px-6 py-4">{formatNumber(a.methodOutputs.mooreAphv, 2)}</td>
                            <td className="px-6 py-4">{a.methodOutputs.pahCm ? `${formatNumber(a.methodOutputs.pahCm, 2)} cm` : "N/A"}</td>
                          </tr>
                          );
                        })}
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
                      {selectedHistory.map((h) => {
                        const hSex = getAssessmentSex(h);
                        const hProfile = createUnifiedProfile(h, selectedEngine, bioBandingStrategy, hSex);
                        return (
                        <tr key={h.inputs.dataCollectionDate} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-medium">{formatDate(h.inputs.dataCollectionDate)}</td>
                          <td className="px-6 py-4 font-medium text-teal-600">{hProfile.offset != null ? formatNumber(hProfile.offset, 2) : "—"}</td>
                          <td className="px-6 py-4">{formatNumber(h.methodOutputs.mooreAphv, 2)} {t("analysis.individual.years")}</td>
                          <td className="px-6 py-4">{formatNumber(h.methodOutputs.mirwaldAphv, 2)} {t("analysis.individual.years")}</td>
                          <td className="px-6 py-4">{h.methodOutputs.pahCm ? `${formatNumber(h.methodOutputs.pahCm, 2)} cm` : "N/A"}</td>
                          <td className="px-6 py-4">{h.methodOutputs.percentageAdultHeight ? `${formatNumber(h.methodOutputs.percentageAdultHeight, 2)}%` : "N/A"}</td>
                        </tr>
                        );
                      })}
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

              {/* STAR / RADAR CHART: Performance profile by area vs comparison group */}
              {performancePercentileStrips.length >= 3 && (
                (() => {
                  // Build one data point per area: average percentile of all tests in that area
                  const areaAverages = performanceAreaOrder
                    .map((area) => {
                      const strips = performancePercentileStrips.filter((s) => s.area === area);
                      if (strips.length === 0) return null;
                      const avg = Math.round(strips.reduce((sum, s) => sum + s.percentile, 0) / strips.length);
                      return { area, label: getAreaLabel(area), percentile: avg, count: strips.length };
                    })
                    .filter((d): d is { area: PerformanceArea; label: string; percentile: number; count: number } => d !== null);

                  if (areaAverages.length < 3) return null;

                  return (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="h-5 w-5 text-amber-500" />
                        <h3 className="font-bold text-slate-900">
                          {locale === 'es' ? 'Perfil de Rendimiento (Gráfico Estrella)' : 'Performance Profile (Star Chart)'}
                        </h3>
                      </div>
                      <p className="text-xs text-slate-400 mb-4 ml-7">
                        {locale === 'es'
                          ? `Percentil medio por área respecto al grupo comparativo`
                          : `Average percentile per area vs comparison group`}
                      </p>
                      <ResponsiveContainer width="99.9%" height={300} minWidth={0} debounce={100}>
                        <RadarChart data={areaAverages} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
                          <PolarGrid stroke="#e2e8f0" />
                          <PolarAngleAxis
                            dataKey="label"
                            tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }}
                          />
                          <PolarRadiusAxis
                            angle={90}
                            domain={[0, 100]}
                            tick={{ fontSize: 9, fill: '#94a3b8' }}
                            tickCount={5}
                          />
                          {/* Reference area: median (50th percentile) */}
                          <Radar
                            name={locale === 'es' ? 'Media grupo' : 'Group median'}
                            dataKey={() => 50}
                            stroke="#94a3b8"
                            fill="#94a3b8"
                            fillOpacity={0.08}
                            strokeDasharray="4 3"
                            strokeWidth={1}
                            dot={false}
                            isAnimationActive={false}
                          />
                          {/* Athlete profile */}
                          <Radar
                            name={selectedLatest?.inputs.athleteName ?? (locale === 'es' ? 'Atleta' : 'Athlete')}
                            dataKey="percentile"
                            stroke="#0d9488"
                            fill="#0d9488"
                            fillOpacity={0.25}
                            strokeWidth={2}
                            dot={{ r: 4, fill: '#0d9488', strokeWidth: 0 }}
                          />
                          <Tooltip
                            formatter={(value: any, name: any) => [`${value ?? '—'}º percentile`, name] as [string, string]}
                            contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 12 }}
                          />
                          <Legend
                            iconSize={10}
                            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                      {/* Mini legend: test count per area */}
                      <div className="mt-2 flex flex-wrap justify-center gap-3">
                        {areaAverages.map((d) => {
                          const style = performanceAreaStyles[d.area] ?? performanceAreaStyles.physical;
                          return (
                            <span key={d.area} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${style.chipIdle}`}>
                              {d.label}
                              <span className="opacity-60">({d.count} {locale === 'es' ? 'test' : 'test'}{d.count !== 1 ? 's' : ''})</span>
                              <span className="font-bold">{d.percentile}º</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()
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
              {/* UC Training Load History */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <Dumbbell className="h-5 w-5 text-teal-600" />
                  <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Carga UC (RPE × Minutos)' : 'UC Load (RPE × Minutes)'}</h3>
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

              {/* GPS Load Section */}
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <MapPin className="h-5 w-5 text-emerald-600" />
                  <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Carga GPS por sesión' : 'GPS Load per Session'}</h3>
                </div>

                {athleteGpsSessions.length > 0 ? (
                  <div className="space-y-6">
                    {/* Distance chart */}
                    {athleteGpsSessions.some(({ row }) => colVal(row, "Distance - Distance (m)") !== undefined) && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          {locale === 'es' ? 'Distancia por sesión (m)' : 'Distance per session (m)'}
                        </p>
                        <div className="h-56">
                          <ResponsiveContainer width="99.9%" height="100%" debounce={100}>
                            <BarChart data={athleteGpsSessions.map(({ session, row }) => ({
                              date: formatDate(session.date),
                              dist: colVal(row, "Distance - Distance (m)") ?? 0,
                              hsr:  colVal(row, "Distance - Abs HSR (m)") ?? 0,
                            }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis fontSize={10} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(v: any) => [`${formatNumber(Number(v), 0)} m`]} />
                              <Legend verticalAlign="top" align="right" />
                              <Bar dataKey="dist" name={locale === 'es' ? 'Distancia total' : 'Total distance'} fill="#6ee7b7" radius={[4,4,0,0]} />
                              <Bar dataKey="hsr"  name="HSR" fill="#10b981" radius={[4,4,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* KPI summary cards */}
                    {(() => {
                      const allDist   = athleteGpsSessions.map(({ row }) => colVal(row, "Distance - Distance (m)") ?? 0).filter(v => v > 0);
                      const allHsr    = athleteGpsSessions.map(({ row }) => colVal(row, "Distance - Abs HSR (m)") ?? 0).filter(v => v > 0);
                      const allSpeed  = athleteGpsSessions.map(({ row }) => colVal(row, "Sprints - Max Speed (km/h)") ?? 0).filter(v => v > 0);
                      const avgDist   = allDist.length  ? allDist.reduce((a,b)=>a+b,0)  / allDist.length  : null;
                      const avgHsr    = allHsr.length   ? allHsr.reduce((a,b)=>a+b,0)   / allHsr.length   : null;
                      const maxSpeed  = allSpeed.length ? Math.max(...allSpeed) : null;
                      return (
                        <div className="grid gap-4 sm:grid-cols-3">
                          {avgDist !== null && (
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">{locale === 'es' ? 'Dist. media / sesión' : 'Avg dist / session'}</p>
                              <p className="text-3xl font-bold text-emerald-900">{formatNumber(avgDist / 1000, 2)} km</p>
                            </div>
                          )}
                          {avgHsr !== null && (
                            <div className="p-4 bg-teal-50 rounded-2xl border border-teal-100 text-center">
                              <p className="text-xs font-bold text-teal-600 uppercase tracking-wider mb-1">{locale === 'es' ? 'HSR media / sesión' : 'Avg HSR / session'}</p>
                              <p className="text-3xl font-bold text-teal-900">{formatNumber(avgHsr / 1000, 2)} km</p>
                            </div>
                          )}
                          {maxSpeed !== null && (
                            <div className="p-4 bg-sky-50 rounded-2xl border border-sky-100 text-center">
                              <p className="text-xs font-bold text-sky-600 uppercase tracking-wider mb-1">{locale === 'es' ? 'Vel. máx registrada' : 'Max speed recorded'}</p>
                              <p className="text-3xl font-bold text-sky-900">{formatNumber(maxSpeed, 1)} km/h</p>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Player Load vs HMLD */}
                    {athleteGpsSessions.some(({ row }) => colVal(row, "Player Load (a.u.)") !== undefined) && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          {locale === 'es' ? 'Player Load y HMLD por sesión' : 'Player Load & HMLD per session'}
                        </p>
                        <div className="h-56">
                          <ResponsiveContainer width="99.9%" height="100%" debounce={100}>
                            <ComposedChart data={athleteGpsSessions.map(({ session, row }) => ({
                              date: formatDate(session.date),
                              playerLoad: colVal(row, "Player Load (a.u.)") ?? 0,
                              hmldM: colVal(row, "Load - HMLD (m)") ?? 0,
                            }))} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis yAxisId="left" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(v: any, name: any) => [formatNumber(Number(v), 1), name]} />
                              <Legend verticalAlign="top" align="right" />
                              <Bar yAxisId="left" dataKey="playerLoad" name="Player Load (a.u.)" fill="#8b5cf6" radius={[4,4,0,0]} opacity={0.85} />
                              <Line yAxisId="right" type="monotone" dataKey="hmldM" name="HMLD (m)" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Accelerations & Decelerations */}
                    {athleteGpsSessions.some(({ row }) => colVal(row, "Accelerations - High Intensity Acc Abs (count)") !== undefined) && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          {locale === 'es' ? 'Aceleraciones y deceleraciones de alta intensidad' : 'High intensity accelerations & decelerations'}
                        </p>
                        <div className="h-52">
                          <ResponsiveContainer width="99.9%" height="100%" debounce={100}>
                            <BarChart data={athleteGpsSessions.map(({ session, row }) => ({
                              date: formatDate(session.date),
                              acc: colVal(row, "Accelerations - High Intensity Acc Abs (count)") ?? 0,
                              dec: Math.abs(colVal(row, "Accelerations - High Intensity Dec Abs (count)") ?? 0),
                            }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis fontSize={10} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(v: any, name: any) => [formatNumber(Number(v), 0), name]} />
                              <Legend verticalAlign="top" align="right" />
                              <Bar dataKey="acc" name={locale === 'es' ? 'Acc alta int.' : 'Hi acc'} fill="#10b981" radius={[4,4,0,0]} />
                              <Bar dataKey="dec" name={locale === 'es' ? 'Dec alta int.' : 'Hi dec'} fill="#f43f5e" radius={[4,4,0,0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Speed zones stacked area */}
                    {athleteGpsSessions.some(({ row }) => colVal(row, "Speed Zones (m) [0.0, 6.0]") !== undefined) && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          {locale === 'es' ? 'Distribución por zonas de velocidad (m)' : 'Speed zone distribution (m)'}
                        </p>
                        <div className="h-56">
                          <ResponsiveContainer width="99.9%" height="100%" debounce={100}>
                            <AreaChart data={athleteGpsSessions.map(({ session, row }) => ({
                              date: formatDate(session.date),
                              z1: colVal(row, "Speed Zones (m) [0.0, 6.0]") ?? 0,
                              z2: colVal(row, "Speed Zones (m) [6.0, 12.0]") ?? 0,
                              z3: colVal(row, "Speed Zones (m) [12.0, 18.0]") ?? 0,
                              z4: colVal(row, "Speed Zones (m) [18.0, 21.0]") ?? 0,
                              z5: colVal(row, "Speed Zones (m) [21.0, 24.0]") ?? 0,
                              z6: colVal(row, "Speed Zones (m) [24.0, 50.0]") ?? 0,
                            }))} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis fontSize={10} axisLine={false} tickLine={false} />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(v: any, name: any) => [`${formatNumber(Number(v), 0)} m`, name]} />
                              <Legend verticalAlign="top" align="right" iconType="square" wrapperStyle={{ fontSize: 10 }} />
                              <Area type="monotone" stackId="1" dataKey="z1" name="0–6 km/h"  stroke="#94a3b8" fill="#e2e8f0" />
                              <Area type="monotone" stackId="1" dataKey="z2" name="6–12 km/h" stroke="#34d399" fill="#6ee7b7" />
                              <Area type="monotone" stackId="1" dataKey="z3" name="12–18 km/h" stroke="#3b82f6" fill="#93c5fd" />
                              <Area type="monotone" stackId="1" dataKey="z4" name="18–21 km/h" stroke="#f59e0b" fill="#fcd34d" />
                              <Area type="monotone" stackId="1" dataKey="z5" name="21–24 km/h" stroke="#f97316" fill="#fdba74" />
                              <Area type="monotone" stackId="1" dataKey="z6" name=">24 km/h"  stroke="#ef4444" fill="#fca5a5" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Sprints count + distance */}
                    {athleteGpsSessions.some(({ row }) => colVal(row, "Sprints Abs (count)") !== undefined) && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                          {locale === 'es' ? 'Sprints: cantidad y distancia acumulada' : 'Sprints: count & accumulated distance'}
                        </p>
                        <div className="h-52">
                          <ResponsiveContainer width="99.9%" height="100%" debounce={100}>
                            <ComposedChart data={athleteGpsSessions.map(({ session, row }) => ({
                              date: formatDate(session.date),
                              count: colVal(row, "Sprints Abs (count)") ?? 0,
                              distM: colVal(row, "Sprints - Distance Abs(m)") ?? 0,
                            }))} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                              <YAxis yAxisId="left" fontSize={10} axisLine={false} tickLine={false} allowDecimals={false} />
                              <YAxis yAxisId="right" orientation="right" fontSize={10} axisLine={false} tickLine={false} unit=" m" />
                              <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} formatter={(v: any, name: any) => [formatNumber(Number(v), 1), name]} />
                              <Legend verticalAlign="top" align="right" />
                              <Bar yAxisId="left" dataKey="count" name={locale === 'es' ? 'Nº sprints' : 'Sprint count'} fill="#0d9488" radius={[4,4,0,0]} />
                              <Line yAxisId="right" type="monotone" dataKey="distM" name={locale === 'es' ? 'Dist. sprint (m)' : 'Sprint dist (m)'} stroke="#7c3aed" strokeWidth={2.5} dot={{ r: 4, fill: '#fff', strokeWidth: 2 }} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}

                    {/* Session table */}
                    <div className="overflow-hidden rounded-xl border border-slate-100">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-medium">
                            <th className="px-4 py-3">{locale === 'es' ? 'Fecha' : 'Date'}</th>
                            <th className="px-4 py-3">{locale === 'es' ? 'Tipo' : 'Type'}</th>
                            <th className="px-4 py-3 text-right">{locale === 'es' ? 'Distancia' : 'Distance'}</th>
                            <th className="px-4 py-3 text-right">HSR</th>
                            <th className="px-4 py-3 text-right">{locale === 'es' ? 'Vel. máx' : 'Max speed'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {athleteGpsSessions.map(({ session, row }, i) => {
                            const dist  = colVal(row, "Distance - Distance (m)") ?? 0;
                            const hsr   = colVal(row, "Distance - Abs HSR (m)") ?? 0;
                            const speed = colVal(row, "Sprints - Max Speed (km/h)") ?? 0;
                            return (
                              <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-4 py-3">{formatDate(session.date)}</td>
                                <td className="px-4 py-3 capitalize">
                                  <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold",
                                    session.sessionType === "match" ? "bg-violet-100 text-violet-700" : "bg-emerald-100 text-emerald-700")}>
                                    {session.sessionType === "match" ? <Trophy className="h-3 w-3" /> : <Dumbbell className="h-3 w-3" />}
                                    {session.sessionType}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right font-medium">{dist > 0 ? `${formatNumber(dist / 1000, 2)} km` : "—"}</td>
                                <td className="px-4 py-3 text-right">{hsr > 0 ? `${formatNumber(hsr / 1000, 2)} km` : "—"}</td>
                                <td className="px-4 py-3 text-right font-bold text-sky-600">{speed > 0 ? `${formatNumber(speed, 1)} km/h` : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <MapPin className="h-12 w-12 mb-3 opacity-20" />
                    <p>{locale === 'es' ? 'No hay sesiones GPS para este atleta' : 'No GPS sessions for this athlete'}</p>
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
// ---------------------------------------------------------------------------
// Helper: compute group stats from a list of assessed athletes
// ---------------------------------------------------------------------------
function computeGroupStats(
  groupData: (MaturationResult & { zScore?: number })[],
  groupLabel: string,
  performanceEntries: PerformanceEntry[],
) {
  if (groupData.length === 0) return null;
  const offsets = groupData.map((a) => a.classification.primaryOffset);
  const meanOff = offsets.reduce((s, v) => s + v, 0) / offsets.length;
  const sdOff = offsets.length > 1
    ? Math.sqrt(offsets.reduce((s, v) => s + (v - meanOff) ** 2, 0) / offsets.length)
    : 0;
  const bandCounts: Record<MaturityBand, number> = { "Pre-PHV": 0, "Mid-PHV": 0, "Post-PHV": 0 };
  groupData.forEach((a) => { if (a.classification.maturityBand) bandCounts[a.classification.maturityBand]++; });
  const sorted = [...groupData].sort((a, b) => a.classification.primaryOffset - b.classification.primaryOffset);

  const athleteIds = new Set(groupData.map((a) => a.inputs.athleteId));
  const latestPsychMap = new Map<string, PerformanceEntry>();
  performanceEntries
    .filter((e) => e.area === "psychological" && athleteIds.has(e.athleteId))
    .forEach((e) => {
      const key = `${e.athleteId}-${e.testName}`;
      const existing = latestPsychMap.get(key);
      if (!existing || e.measurementDate > existing.measurementDate) latestPsychMap.set(key, e);
    });
  const psychAverages = Array.from(latestPsychMap.values()).reduce(
    (acc: Record<string, { total: number; count: number }>, e) => {
      if (!acc[e.testName]) acc[e.testName] = { total: 0, count: 0 };
      acc[e.testName].total += e.value; acc[e.testName].count += 1; return acc;
    }, {}
  );
  const psychScores = Object.entries(psychAverages).map(([name, d]) => ({
    name, value: Number((d.total / d.count).toFixed(2)),
  }));

  // Per-area performance averages (latest entry per athlete per test)
  const areaTestMap = new Map<string, { total: number; count: number; area: PerformanceArea }>();
  performanceEntries
    .filter((e) => athleteIds.has(e.athleteId) && e.area !== "psychological")
    .sort((a, b) => b.measurementDate.localeCompare(a.measurementDate))
    .forEach((e) => {
      const key = `${e.athleteId}-${e.testName}`;
      if (!areaTestMap.has(`seen-${key}`)) {
        areaTestMap.set(`seen-${key}`, { total: 0, count: 0, area: e.area });
        const agg = areaTestMap.get(e.testName) ?? { total: 0, count: 0, area: e.area };
        agg.total += e.value; agg.count += 1;
        areaTestMap.set(e.testName, agg);
      }
    });

  return {
    label: groupLabel,
    athletes: groupData.map((a) => ({
      ...a,
      zScore: sdOff === 0 ? 0 : (a.classification.primaryOffset - meanOff) / sdOff,
    })),
    meanOffset: meanOff,
    meanAge: groupData.reduce((s, a) => s + a.derivedMetrics.chronologicalAge, 0) / groupData.length,
    meanStature: groupData.reduce((s, a) => s + a.inputs.statureCm, 0) / groupData.length,
    meanWeight: groupData.reduce((s, a) => s + a.inputs.bodyMassKg, 0) / groupData.length,
    bandCounts,
    sdOffset: sdOff,
    earliest: sorted[0],
    latest: sorted[sorted.length - 1],
    maturitySpread: sorted.length > 1 ? sorted[sorted.length - 1].classification.primaryOffset - sorted[0].classification.primaryOffset : 0,
    psychScores,
  };
}

type CollectiveGroupMode = "team" | "maturityBand";

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
  const { selectedEngine, bioBandingStrategy } = useMaturationPreferences();

  const teams = useMemo(() => getUniqueAthleteTeams(state.athletes), [state.athletes]);

  // Group mode: by team or by maturity band
  const [groupMode, setGroupMode] = useState<CollectiveGroupMode>("team");

  // Primary group selector (team or band)
  const [primaryGroup, setPrimaryGroup] = usePersistentState<string>(
    "analysis_collective_team",
    teams[0] ?? ""
  );

  // Secondary group for comparison (optional)
  const [compareGroup, setCompareGroup] = useState<string>("");

  // Initialize with the first team if none has been persisted yet
  useEffect(() => {
    if (!primaryGroup && teams.length > 0) setPrimaryGroup(teams[0]);
  }, [teams, primaryGroup, setPrimaryGroup]);

  // Reset compare group when mode or primary changes
  useEffect(() => { setCompareGroup(""); }, [groupMode, primaryGroup]);

  const latestByAthlete = useMemo(
    () => getLatestAssessmentsByAthlete(assessments).map((assessment) => {
      const athleteSex = resolveAssessmentSex(assessment, state.athletes);
      const profile = createUnifiedProfile(assessment, selectedEngine, bioBandingStrategy, athleteSex);
      return {
        ...assessment,
        classification: {
          ...assessment.classification,
          maturityBand: getGroupingBand(profile),
          primaryOffset: profile.offset ?? assessment.classification.primaryOffset,
        },
      };
    }),
    [assessments, selectedEngine, bioBandingStrategy, state.athletes],
  );

  // Available groups depending on mode
  const availableGroups = useMemo(() => {
    if (groupMode === "team") return teams;
    const bands = new Set<string>();
    latestByAthlete.forEach((a) => { if (a.classification.maturityBand) bands.add(a.classification.maturityBand); });
    return (["Pre-PHV", "Mid-PHV", "Post-PHV"] as MaturityBand[]).filter((b) => bands.has(b));
  }, [groupMode, teams, latestByAthlete]);

  // Filter athletes for a given group key
  const getGroupAthletes = (key: string) =>
    groupMode === "team"
      ? latestByAthlete.filter((a) => a.inputs.teamName === key)
      : latestByAthlete.filter((a) => a.classification.maturityBand === key);

  const primaryStats = useMemo(() => {
    if (!primaryGroup) return null;
    return computeGroupStats(getGroupAthletes(primaryGroup), primaryGroup, state.performanceEntries);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestByAthlete, primaryGroup, groupMode, state.performanceEntries]);

  const compareStats = useMemo(() => {
    if (!compareGroup) return null;
    return computeGroupStats(getGroupAthletes(compareGroup), compareGroup, state.performanceEntries);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestByAthlete, compareGroup, groupMode, state.performanceEntries]);

  // Force Recharts to re-measure after tab/group changes
  useEffect(() => {
    const t = setTimeout(() => window.dispatchEvent(new Event("resize")), 300);
    return () => clearTimeout(t);
  }, [primaryGroup, compareGroup, groupMode]);

  // ---- Derived chart data ----
  const offsetData = primaryStats
    ? primaryStats.athletes
        .map((a) => ({
          name: a.inputs.athleteName,
          offset: Number(a.classification.primaryOffset.toFixed(2)),
          band: a.classification.maturityBand,
        }))
        .sort((a, b) => a.offset - b.offset)
    : [];

  const scatterPrimary = primaryStats
    ? primaryStats.athletes.map((a) => ({
        age: Number(a.derivedMetrics.chronologicalAge.toFixed(2)),
        offset: Number(a.classification.primaryOffset.toFixed(2)),
        name: a.inputs.athleteName,
        band: a.classification.maturityBand,
      }))
    : [];

  const scatterCompare = compareStats
    ? compareStats.athletes.map((a) => ({
        age: Number(a.derivedMetrics.chronologicalAge.toFixed(2)),
        offset: Number(a.classification.primaryOffset.toFixed(2)),
        name: a.inputs.athleteName,
        band: a.classification.maturityBand,
      }))
    : [];

  // Comparison bar data: key metrics side-by-side
  const comparisonMetrics = (primaryStats && compareStats)
    ? [
        { label: locale === 'es' ? 'Offset medio' : 'Mean offset', primary: Number(primaryStats.meanOffset.toFixed(2)), compare: Number(compareStats.meanOffset.toFixed(2)) },
        { label: locale === 'es' ? 'Edad media' : 'Mean age', primary: Number(primaryStats.meanAge.toFixed(2)), compare: Number(compareStats.meanAge.toFixed(2)) },
        { label: locale === 'es' ? 'Talla media (cm)' : 'Mean stature (cm)', primary: Number(primaryStats.meanStature.toFixed(1)), compare: Number(compareStats.meanStature.toFixed(1)) },
        { label: locale === 'es' ? 'Masa media (kg)' : 'Mean mass (kg)', primary: Number(primaryStats.meanWeight.toFixed(1)), compare: Number(compareStats.meanWeight.toFixed(1)) },
        { label: locale === 'es' ? 'Dispersión maduración' : 'Maturity spread', primary: Number(primaryStats.maturitySpread.toFixed(2)), compare: Number(compareStats.maturitySpread.toFixed(2)) },
      ]
    : [];

  const bandLabels: Record<MaturityBand, string> = {
    "Pre-PHV": locale === 'es' ? 'Pre-PHV' : 'Pre-PHV',
    "Mid-PHV": locale === 'es' ? 'En-PHV' : 'Mid-PHV',
    "Post-PHV": locale === 'es' ? 'Post-PHV' : 'Post-PHV',
  };

  const getBandStyle = (band: string | null) => {
    if (band === "Pre-PHV") return "bg-teal-100 text-teal-800 border-teal-200";
    if (band === "Mid-PHV") return "bg-amber-100 text-amber-800 border-amber-200";
    if (band === "Post-PHV") return "bg-slate-200 text-slate-700 border-slate-300";
    return "bg-slate-100 text-slate-500";
  };

  const getTeamAdvice = (stats: ReturnType<typeof computeGroupStats>) => {
    if (!stats) return [];
    const advice = [];
    const { bandCounts } = stats;
    const total = stats.athletes.length;
    if (bandCounts["Mid-PHV"] / total > 0.4) advice.push({ title: t("analysis.collective.adviceHighMidPHVTitle"), text: t("analysis.collective.adviceHighMidPHVText"), type: "warning" });
    else if (bandCounts["Pre-PHV"] / total > 0.6) advice.push({ title: t("analysis.collective.adviceHighPrePHVTitle"), text: t("analysis.collective.adviceHighPrePHVText"), type: "info" });
    else if (bandCounts["Post-PHV"] / total > 0.6) advice.push({ title: t("analysis.collective.adviceHighPostPHVTitle"), text: t("analysis.collective.adviceHighPostPHVText"), type: "success" });
    const lowPsych = stats.psychScores.filter((s) => s.value < 6);
    if (lowPsych.length > 0) advice.push({ title: t("analysis.collective.advicePsychTitle"), text: t("analysis.collective.advicePsychText").replace("{metrics}", lowPsych.map((s) => s.name).join(", ")), type: "warning" });
    return advice;
  };

  // Stacked band distribution for multi-group comparison
  const bandDistributionData = useMemo(() => {
    return availableGroups.map((g) => {
      const athletes = getGroupAthletes(g);
      const pre = athletes.filter((a) => a.classification.maturityBand === "Pre-PHV").length;
      const mid = athletes.filter((a) => a.classification.maturityBand === "Mid-PHV").length;
      const post = athletes.filter((a) => a.classification.maturityBand === "Post-PHV").length;
      return { name: g, "Pre-PHV": pre, "Mid-PHV": mid, "Post-PHV": post, total: athletes.length };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableGroups, latestByAthlete, groupMode]);

  const COMPARE_COLOR = "#6366f1";
  const PRIMARY_COLOR = "#0d9488";

  return (
    <div className="space-y-6">

      {/* ── TOOLBAR ── */}
      <div className="flex flex-wrap items-center gap-3 no-print">
        {/* Mode toggle */}
        <div className="flex rounded-xl border border-slate-200 bg-white overflow-hidden text-sm font-semibold shadow-sm">
          <button
            type="button"
            onClick={() => setGroupMode("team")}
            className={`px-4 py-2 transition-colors ${groupMode === "team" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{locale === 'es' ? 'Por equipo' : 'By team'}</span>
          </button>
          <button
            type="button"
            onClick={() => setGroupMode("maturityBand")}
            className={`px-4 py-2 transition-colors ${groupMode === "maturityBand" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"}`}
          >
            <span className="flex items-center gap-1.5"><Activity className="h-4 w-4" />{locale === 'es' ? 'Por maduración' : 'By maturity'}</span>
          </button>
        </div>

        {/* Primary group */}
        <select
          value={primaryGroup}
          onChange={(e) => setPrimaryGroup(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-500/10"
        >
          <option value="">{locale === 'es' ? '— Grupo principal —' : '— Primary group —'}</option>
          {availableGroups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>

        {/* Compare group (optional) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{locale === 'es' ? 'vs' : 'vs'}</span>
          <select
            value={compareGroup}
            onChange={(e) => setCompareGroup(e.target.value)}
            className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/10"
          >
            <option value="">{locale === 'es' ? '— Sin comparativa —' : '— No comparison —'}</option>
            {availableGroups.filter((g) => g !== primaryGroup).map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          {compareGroup && (
            <button type="button" onClick={() => setCompareGroup("")} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <button
          onClick={() => window.print()}
          className="ml-auto flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl text-sm font-semibold hover:bg-slate-700 transition-colors shadow-sm"
        >
          <Download className="h-4 w-4" />PDF
        </button>
      </div>

      {/* ── OVERVIEW: all groups band distribution ── */}
      {bandDistributionData.length > 1 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Group className="h-5 w-5 text-slate-600" />
            <h3 className="font-bold text-slate-900">{locale === 'es' ? 'Distribución madurativa — todos los grupos' : 'Maturity distribution — all groups'}</h3>
          </div>
          <ResponsiveContainer width="99.9%" height={180} minWidth={0} debounce={100}>
            <BarChart data={bandDistributionData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(val: any, name: any) => [formatNumber(Number(val), 0), name]} contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)", fontSize: 12 }} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Pre-PHV" stackId="a" fill={bandColors["Pre-PHV"]} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Mid-PHV" stackId="a" fill={bandColors["Mid-PHV"]} />
              <Bar dataKey="Post-PHV" stackId="a" fill={bandColors["Post-PHV"]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {!primaryStats ? (
        <div className="h-48 flex items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <p>{t("analysis.collective.noData")}</p>
        </div>
      ) : (
        <div className="space-y-6 print:space-y-8">
          <div className="hidden print:block border-b pb-4 mb-4">
            <h1 className="text-2xl font-bold">{t("analysis.collective.reportTitle")}: {primaryGroup}{compareGroup ? ` vs ${compareGroup}` : ""}</h1>
            <p className="text-slate-500">{formatDate(new Date().toISOString())}</p>
          </div>

          {/* ── KPI CARDS: primary (and compare) ── */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            {[
              { label: t("analysis.collective.avgOffset"), val: primaryStats.meanOffset, cval: compareStats?.meanOffset, explain: t("analysis.collective.avgOffsetExplanation"), suffix: "" },
              { label: t("analysis.collective.avgAge"), val: primaryStats.meanAge, cval: compareStats?.meanAge, explain: t("analysis.collective.avgAgeExplanation"), suffix: ` ${t("analysis.collective.years")}` },
              { label: t("analysis.collective.avgStature"), val: primaryStats.meanStature, cval: compareStats?.meanStature, explain: t("analysis.collective.avgStatureExplanation"), suffix: " cm" },
              { label: t("analysis.collective.avgWeight"), val: primaryStats.meanWeight, cval: compareStats?.meanWeight, explain: t("analysis.collective.avgWeightExplanation"), suffix: " kg" },
            ].map(({ label, val, cval, explain, suffix }) => (
              <div key={label} className="metric-card rounded-[1.75rem] p-5 relative group">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-ink-soft">{label}</p>
                  <div className="relative group/tooltip">
                    <Info className="h-3.5 w-3.5 text-slate-300 hover:text-slate-500 cursor-help transition-colors" />
                    <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all z-10 shadow-xl pointer-events-none font-normal">
                      {explain}
                      <div className="absolute top-full right-1.5 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                </div>
                <p suppressHydrationWarning className="mt-1 text-2xl font-bold" style={{ color: PRIMARY_COLOR }}>{formatNumber(val, 2)}{suffix}</p>
                {cval !== undefined && (
                  <p suppressHydrationWarning className="text-sm font-semibold mt-0.5" style={{ color: COMPARE_COLOR }}>
                    {formatNumber(cval, 2)}{suffix}
                    <span className={`ml-1.5 text-xs font-bold ${val - cval > 0 ? "text-emerald-600" : val - cval < 0 ? "text-rose-600" : "text-slate-400"}`}>
                      {val - cval > 0 ? "▲" : val - cval < 0 ? "▼" : "="}{formatNumber(Math.abs(val - cval), 2)}
                    </span>
                  </p>
                )}
                {cval === undefined && (
                  <div className="mt-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full rounded-full bg-teal-500" style={{ width: `${Math.min(100, Math.max(0, ((val + 5) / 10) * 100))}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── BAND BREAKDOWN CARDS ── */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Primary band pills */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-teal-600" />
                <h3 className="font-bold text-sm text-slate-900">{primaryGroup} — {locale === 'es' ? 'Distribución por banda' : 'Band breakdown'}</h3>
              </div>
              <div className="space-y-3">
                {(["Pre-PHV", "Mid-PHV", "Post-PHV"] as MaturityBand[]).map((band) => {
                  const count = primaryStats.bandCounts[band];
                  const total = primaryStats.athletes.length;
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  return (
                    <div key={band}>
                      <div className="flex justify-between text-xs font-semibold mb-1">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] ${getBandStyle(band)}`}>{bandLabels[band]}</span>
                        <span className="text-slate-500">{count} {locale === 'es' ? 'atleta' : 'athlete'}{count !== 1 ? 's' : ''} · {pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bandColors[band] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
                <div><span className="block text-base font-bold text-slate-700">{formatNumber(primaryStats.maturitySpread, 2)}</span>{locale === 'es' ? 'Dispersión' : 'Spread'}</div>
                <div><span className="block text-base font-bold text-slate-700">{formatNumber(primaryStats.sdOffset, 2)}</span>SD offset</div>
                <div><span className="block text-base font-bold text-slate-700">{primaryStats.athletes.length}</span>{locale === 'es' ? 'Atletas' : 'Athletes'}</div>
              </div>
            </div>

            {/* Compare band pills or advice */}
            {compareStats ? (
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-4 w-4 text-indigo-500" />
                  <h3 className="font-bold text-sm text-slate-900">{compareGroup} — {locale === 'es' ? 'Distribución por banda' : 'Band breakdown'}</h3>
                </div>
                <div className="space-y-3">
                  {(["Pre-PHV", "Mid-PHV", "Post-PHV"] as MaturityBand[]).map((band) => {
                    const count = compareStats.bandCounts[band];
                    const total = compareStats.athletes.length;
                    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                    return (
                      <div key={band}>
                        <div className="flex justify-between text-xs font-semibold mb-1">
                          <span className={`px-2 py-0.5 rounded-full border text-[10px] ${getBandStyle(band)}`}>{bandLabels[band]}</span>
                          <span className="text-slate-500">{count} {locale === 'es' ? 'atleta' : 'athlete'}{count !== 1 ? 's' : ''} · {pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: bandColors[band] }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-slate-400">
                  <div><span className="block text-base font-bold text-slate-700">{formatNumber(compareStats.maturitySpread, 2)}</span>{locale === 'es' ? 'Dispersión' : 'Spread'}</div>
                  <div><span className="block text-base font-bold text-slate-700">{formatNumber(compareStats.sdOffset, 2)}</span>SD offset</div>
                  <div><span className="block text-base font-bold text-slate-700">{compareStats.athletes.length}</span>{locale === 'es' ? 'Atletas' : 'Athletes'}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-4 w-4 text-teal-600" />
                  <h3 className="font-bold text-sm text-slate-900">{t("analysis.collective.strategicAdvice")}</h3>
                </div>
                <div className="space-y-3">
                  {getTeamAdvice(primaryStats).map((a, i) => (
                    <div key={i} className={`p-3 rounded-xl border text-sm ${a.type === "warning" ? "bg-amber-50 border-amber-200" : a.type === "success" ? "bg-emerald-50 border-emerald-200" : "bg-blue-50 border-blue-200"}`}>
                      <p className="font-bold mb-0.5">{a.title}</p>
                      <p className="opacity-80 text-xs">{a.text}</p>
                    </div>
                  ))}
                  {getTeamAdvice(primaryStats).length === 0 && <p className="text-sm text-slate-500 italic">{t("analysis.collective.noAdvice")}</p>}
                </div>
              </div>
            )}
          </div>

          {/* ── COMPARISON METRIC BAR CHART ── */}
          {comparisonMetrics.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900">{locale === 'es' ? `Comparativa: ${primaryGroup} vs ${compareGroup}` : `Comparison: ${primaryGroup} vs ${compareGroup}`}</h3>
              </div>
              <ResponsiveContainer width="99.9%" height={220} minWidth={0} debounce={100}>
                <BarChart data={comparisonMetrics} layout="vertical" margin={{ left: 140, right: 32, top: 4, bottom: 4 }}>
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={140} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)", fontSize: 12 }} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                  <Bar dataKey="primary" name={primaryGroup} fill={PRIMARY_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
                  <Bar dataKey="compare" name={compareGroup} fill={COMPARE_COLOR} radius={[0, 4, 4, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── OFFSET WATERFALL + SCATTER ── */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Offset bar by athlete */}
            <div className="panel rounded-[1.75rem] p-6">
              <h2 className="mb-4 text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-slate-500" />
                {t("analysis.collective.offsetsTitle")} — {primaryGroup}
              </h2>
              <div className="h-64 w-full relative">
                <ResponsiveContainer width="99.9%" height={256} minWidth={0} debounce={100}>
                  <BarChart data={offsetData} margin={{ top: 4, right: 8, left: 0, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(30,41,59,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-35} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
                    <Tooltip formatter={(val: any) => [formatNumber(Number(val), 2), t("datahub.offset")]} contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)", fontSize: 12 }} />
                    <Bar dataKey="offset" radius={[4, 4, 0, 0]} barSize={20}>
                      {offsetData.map((entry, i) => (
                        <Cell key={i} fill={bandColors[entry.band as keyof typeof bandColors] ?? "#94a3b8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Age vs Offset scatter */}
            <div className="panel rounded-[1.75rem] p-6">
              <h2 className="mb-4 text-base font-semibold flex items-center gap-2">
                <Target className="h-4 w-4 text-slate-500" />
                {locale === 'es' ? 'Edad vs Offset PHV' : 'Age vs PHV Offset'}
              </h2>
              <div className="h-64 w-full relative">
                <ResponsiveContainer width="99.9%" height={256} minWidth={0} debounce={100}>
                  <ScatterChart margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="age" type="number" tick={{ fontSize: 10 }} unit={locale === 'es' ? 'a' : 'y'} name={locale === 'es' ? 'Edad' : 'Age'} axisLine={false} tickLine={false} />
                    <YAxis dataKey="offset" type="number" tick={{ fontSize: 10 }} name="Offset" axisLine={false} tickLine={false} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 2" />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      content={({ payload }: any) => {
                        if (!payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div className="rounded-xl bg-white p-3 shadow-lg border border-slate-100 text-xs">
                            <p className="font-bold text-slate-800 mb-1">{d?.name}</p>
                            <p className="text-slate-500">{locale === 'es' ? 'Edad' : 'Age'}: <span className="font-semibold text-slate-700">{d?.age}</span></p>
                            <p className="text-slate-500">Offset: <span className="font-semibold text-teal-600">{d?.offset}</span></p>
                            {d?.band && <span className={`mt-1 inline-block px-1.5 py-0.5 rounded-full border text-[10px] font-bold ${getBandStyle(d.band)}`}>{d.band}</span>}
                          </div>
                        );
                      }}
                    />
                    {/* Primary group */}
                    <Scatter name={primaryGroup} data={scatterPrimary} fill={PRIMARY_COLOR}>
                      {scatterPrimary.map((entry, idx) => (
                        <Cell key={`p-${idx}`} fill={bandColors[entry.band as keyof typeof bandColors] ?? PRIMARY_COLOR} />
                      ))}
                    </Scatter>
                    {/* Compare group */}
                    {scatterCompare.length > 0 && (
                      <Scatter name={compareGroup} data={scatterCompare} fill={COMPARE_COLOR} shape="triangle">
                        {scatterCompare.map((_, idx) => <Cell key={`c-${idx}`} fill={COMPARE_COLOR} />)}
                      </Scatter>
                    )}
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
              {compareStats && (
                <div className="mt-2 flex gap-4 text-[11px] text-slate-500 justify-center">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded-full" style={{ background: PRIMARY_COLOR }} />{primaryGroup}</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: COMPARE_COLOR }} />{compareGroup}</span>
                </div>
              )}
            </div>
          </div>

          {/* ── PSYCHOLOGICAL PROFILE ── */}
          {primaryStats.psychScores.length > 0 && (
            <div className="panel rounded-[1.75rem] p-6">
              <h2 className="mb-4 text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                {t("analysis.collective.psychologicalProfile")}
                {compareStats && compareStats.psychScores.length > 0 && ` — ${locale === 'es' ? 'comparativa' : 'comparison'}`}
              </h2>
              {(() => {
                const allTests = Array.from(new Set([
                  ...primaryStats.psychScores.map((s) => s.name),
                  ...(compareStats?.psychScores.map((s) => s.name) ?? []),
                ]));
                const merged = allTests.map((name) => ({
                  name,
                  [primaryGroup]: primaryStats.psychScores.find((s) => s.name === name)?.value ?? 0,
                  ...(compareStats ? { [compareGroup]: compareStats.psychScores.find((s) => s.name === name)?.value ?? 0 } : {}),
                }));
                return (
                  <ResponsiveContainer width="99.9%" height={Math.max(180, merged.length * 38)} minWidth={0} debounce={100}>
                    <BarChart layout="vertical" data={merged} margin={{ left: 130, right: 32, top: 4, bottom: 4 }}>
                      <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={130} axisLine={false} tickLine={false} />
                      <CartesianGrid vertical={true} horizontal={false} strokeDasharray="3 3" stroke="rgba(15,23,42,0.05)" />
                      <ReferenceLine x={6} stroke="#fbbf24" strokeDasharray="4 2" label={{ value: "6", fontSize: 9, fill: "#fbbf24" }} />
                      <Tooltip formatter={(val: any) => [formatNumber(Number(val), 2), ""]} contentStyle={{ borderRadius: 10, border: "none", boxShadow: "0 4px 12px rgba(0,0,0,.1)", fontSize: 12 }} />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar dataKey={primaryGroup} fill={PRIMARY_COLOR} radius={[0, 4, 4, 0]} barSize={compareStats ? 10 : 16} />
                      {compareStats && <Bar dataKey={compareGroup} fill={COMPARE_COLOR} radius={[0, 4, 4, 0]} barSize={10} />}
                    </BarChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
          )}

          {/* ── ATHLETE TABLE ── */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">{primaryGroup} — {t("analysis.collective.bandCounts")}</h3>
              <span className="text-xs text-slate-400 font-semibold">{primaryStats.athletes.length} {locale === 'es' ? 'atletas' : 'athletes'}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3 font-semibold">{t("datahub.player")}</th>
                    <th className="px-5 py-3 font-semibold">{t("datahub.age")}</th>
                    <th className="px-5 py-3 font-semibold">{t("datahub.stature")}</th>
                    <th className="px-5 py-3 font-semibold">{t("datahub.offset")}</th>
                    <th className="px-5 py-3 font-semibold">Z-Score</th>
                    <th className="px-5 py-3 font-semibold">{t("analysisExtra.maturityBand")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {primaryStats.athletes.map((a) => (
                    <tr key={a.inputs.athleteId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3 font-semibold text-slate-800">{a.inputs.athleteName}</td>
                      <td className="px-5 py-3 text-slate-600">{formatNumber(a.derivedMetrics.chronologicalAge, 2)}</td>
                      <td className="px-5 py-3 text-slate-600">{formatNumber(a.inputs.statureCm, 1)} cm</td>
                      <td suppressHydrationWarning className="px-5 py-3 font-bold text-teal-600">{formatNumber(a.classification.primaryOffset, 2)}</td>
                      <td suppressHydrationWarning className="px-5 py-3">
                        <span className={`font-semibold ${a.zScore > 1 ? "text-amber-600" : a.zScore < -1 ? "text-blue-600" : "text-slate-500"}`}>
                          {formatNumber(a.zScore, 2)}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getBandStyle(a.classification.maturityBand)}`}>
                          {a.classification.maturityBand ? bandLabels[a.classification.maturityBand] : "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── COMPARE GROUP TABLE (when active) ── */}
          {compareStats && (
            <div className="rounded-2xl border border-indigo-100 overflow-hidden shadow-sm">
              <div className="p-5 border-b border-indigo-100 bg-indigo-50/60 flex items-center justify-between">
                <h3 className="font-bold text-indigo-900">{compareGroup} — {t("analysis.collective.bandCounts")}</h3>
                <span className="text-xs text-indigo-400 font-semibold">{compareStats.athletes.length} {locale === 'es' ? 'atletas' : 'athletes'}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-indigo-50/40 text-slate-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3 font-semibold">{t("datahub.player")}</th>
                      <th className="px-5 py-3 font-semibold">{t("datahub.age")}</th>
                      <th className="px-5 py-3 font-semibold">{t("datahub.stature")}</th>
                      <th className="px-5 py-3 font-semibold">{t("datahub.offset")}</th>
                      <th className="px-5 py-3 font-semibold">Z-Score</th>
                      <th className="px-5 py-3 font-semibold">{t("analysisExtra.maturityBand")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-indigo-50">
                    {compareStats.athletes.map((a) => (
                      <tr key={a.inputs.athleteId} className="hover:bg-indigo-50/40 transition-colors">
                        <td className="px-5 py-3 font-semibold text-slate-800">{a.inputs.athleteName}</td>
                        <td className="px-5 py-3 text-slate-600">{formatNumber(a.derivedMetrics.chronologicalAge, 2)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatNumber(a.inputs.statureCm, 1)} cm</td>
                        <td suppressHydrationWarning className="px-5 py-3 font-bold text-indigo-600">{formatNumber(a.classification.primaryOffset, 2)}</td>
                        <td suppressHydrationWarning className="px-5 py-3">
                          <span className={`font-semibold ${a.zScore > 1 ? "text-amber-600" : a.zScore < -1 ? "text-blue-600" : "text-slate-500"}`}>
                            {formatNumber(a.zScore, 2)}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getBandStyle(a.classification.maturityBand)}`}>
                            {a.classification.maturityBand ? bandLabels[a.classification.maturityBand] : "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ASSISTANT TAB — Smart Alerts with team/player drill-down
// ---------------------------------------------------------------------------

/** @deprecated — mascot removed in redesign */
function CoachMascot({ mood }: { mood: "happy" | "alert" | "warning" | "neutral" }) {
  const faceColor = mood === "happy" ? "#0d9488" : mood === "alert" ? "#dc2626" : mood === "warning" ? "#d97706" : "#475569";
  const bodyColor = mood === "happy" ? "#ccfbf1" : mood === "alert" ? "#fee2e2" : mood === "warning" ? "#fef3c7" : "#f1f5f9";
  const shirtColor = mood === "happy" ? "#0d9488" : mood === "alert" ? "#dc2626" : mood === "warning" ? "#d97706" : "#64748b";

  return (
    <svg viewBox="0 0 120 160" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      {/* Body / shirt */}
      <rect x="28" y="80" width="64" height="56" rx="12" fill={shirtColor} />
      {/* Arms */}
      <rect x="8" y="82" width="22" height="12" rx="6" fill={shirtColor} />
      <rect x="90" y="82" width="22" height="12" rx="6" fill={shirtColor} />
      {/* Clipboard in right hand */}
      <rect x="94" y="88" width="20" height="26" rx="3" fill="#fff" stroke={faceColor} strokeWidth="1.5" />
      <rect x="97" y="92" width="14" height="2" rx="1" fill={faceColor} opacity="0.4" />
      <rect x="97" y="96" width="10" height="2" rx="1" fill={faceColor} opacity="0.4" />
      <rect x="97" y="100" width="12" height="2" rx="1" fill={faceColor} opacity="0.4" />
      {/* Neck */}
      <rect x="50" y="68" width="20" height="14" rx="4" fill="#fcd9b6" />
      {/* Head */}
      <circle cx="60" cy="52" r="28" fill="#fcd9b6" />
      {/* Hair */}
      <path d="M32 44 Q60 20 88 44" fill="#92400e" />
      {/* Eyes */}
      {mood === "happy" && (
        <>
          <path d="M48 50 Q51 46 54 50" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M66 50 Q69 46 72 50" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />
        </>
      )}
      {(mood === "alert" || mood === "warning") && (
        <>
          <ellipse cx="51" cy="50" rx="4" ry="4.5" fill="#1e293b" />
          <ellipse cx="69" cy="50" rx="4" ry="4.5" fill="#1e293b" />
          <circle cx="52.5" cy="48.5" r="1.2" fill="white" />
          <circle cx="70.5" cy="48.5" r="1.2" fill="white" />
          {/* Worried brow */}
          <path d="M46 44 Q51 41 56 44" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M64 44 Q69 41 74 44" stroke="#92400e" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </>
      )}
      {mood === "neutral" && (
        <>
          <ellipse cx="51" cy="50" rx="4" ry="4.5" fill="#1e293b" />
          <ellipse cx="69" cy="50" rx="4" ry="4.5" fill="#1e293b" />
          <circle cx="52.5" cy="48.5" r="1.2" fill="white" />
          <circle cx="70.5" cy="48.5" r="1.2" fill="white" />
        </>
      )}
      {/* Mouth */}
      {mood === "happy" && <path d="M50 61 Q60 68 70 61" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />}
      {mood === "alert" && <path d="M50 63 Q60 59 70 63" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />}
      {mood === "warning" && <path d="M50 62 Q60 60 70 62" stroke="#1e293b" strokeWidth="2" strokeLinecap="round" fill="none" />}
      {mood === "neutral" && <path d="M50 62 Q60 65 70 62" stroke="#1e293b" strokeWidth="1.5" strokeLinecap="round" fill="none" />}
      {/* Legs */}
      <rect x="36" y="132" width="18" height="20" rx="6" fill="#1e293b" />
      <rect x="66" y="132" width="18" height="20" rx="6" fill="#1e293b" />
      {/* Shoes */}
      <rect x="32" y="148" width="26" height="10" rx="5" fill="#0f172a" />
      <rect x="62" y="148" width="26" height="10" rx="5" fill="#0f172a" />
      {/* Whistle */}
      <circle cx="60" cy="90" r="5" fill="#fbbf24" />
      <rect x="58" y="85" width="4" height="6" rx="1" fill="#fbbf24" />
    </svg>
  );
}

// ── helpers shared across SmartAlerts sub-components ─────────────────────────

type UrgencyLevel = "critical" | "warning" | "monitoring" | "ok";

function getUrgencyLevel(alerts: AlertItem[], band: MaturityBand | null, enrichedSignals?: InsightSignal[]): UrgencyLevel {
  if (alerts.some((a) => a.severity === "critical")) return "critical";
  if (enrichedSignals?.some((s) => s.severity === "critical")) return "critical";
  if (alerts.some((a) => a.severity === "warning")) return "warning";
  if (enrichedSignals?.some((s) => s.severity === "warning")) return "warning";
  if (band === "Mid-PHV") return "monitoring";
  return "ok";
}

function urgencyOrder(u: UrgencyLevel) {
  return u === "critical" ? 0 : u === "warning" ? 1 : u === "monitoring" ? 2 : 3;
}

function getBandChipSA(band: MaturityBand | null) {
  if (band === "Pre-PHV") return "bg-teal-100 text-teal-800 border-teal-200";
  if (band === "Mid-PHV") return "bg-amber-100 text-amber-800 border-amber-200";
  if (band === "Post-PHV") return "bg-slate-200 text-slate-700 border-slate-300";
  return "bg-slate-100 text-slate-500 border-slate-200";
}

function bandLabelSA(band: MaturityBand | null, loc: string) {
  if (!band) return "—";
  if (loc === "es") return band === "Mid-PHV" ? "En-PHV" : band;
  return band;
}

// ── enriched signal: derives contextual insights from performance + load data ─

type InsightSignal = {
  kind:
    | "perfDrop"
    | "perfTrend"
    | "perfTrendSeries"    // NEW: trend over full series (linear regression)
    | "perfPercentile"     // NEW: vs same maturity band
    | "loadSpike"
    | "loadHighVsTeam"
    | "loadACWR"           // NEW: acute:chronic workload ratio
    | "loadMonotony"       // NEW: RPE variability / monotony
    | "growthJustified"
    | "growthVelocity"     // NEW: cm/month growth rate
    | "offsetTrend";       // NEW: offset trending toward PHV
  severity: "critical" | "warning" | "info";
  pilar: "maturation" | "performance" | "load";
  message: string;
  detail?: string;
};

// ── Linear regression helper (returns slope normalised per step) ────────────
function linearTrendSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  values.forEach((v, i) => { num += (i - meanX) * (v - meanY); den += (i - meanX) ** 2; });
  return den === 0 ? 0 : num / den;
}

// ── Percentile rank of value within array (0–100) ───────────────────────────
function percentileRank(value: number, population: number[]): number {
  if (population.length === 0) return 50;
  const below = population.filter((v) => v < value).length;
  return Math.round((below / population.length) * 100);
}

function buildEnrichedSignals(
  athleteId: string,
  band: MaturityBand | null,
  offset: number | null,
  state: ReturnType<typeof useAppState>["state"],
  locale: string,
  allLatestAssessments?: { athleteId: string; band: MaturityBand | null; offset: number | null }[],
): InsightSignal[] {
  const es = locale === "es";
  const signals: InsightSignal[] = [];

  const perfEntries = state.performanceEntries.filter((e) => e.athleteId === athleteId);
  const loadEntries = state.trainingLoadEntries.filter((e) => e.athleteId === athleteId);
  const today = new Date();

  // ═══════════════════════════════════════════════════════════════════════════
  // PILAR 1 — MADURACIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  // ─ Growth velocity (from all assessments for this athlete sorted by date) ─
  const athleteAssessments = (state.records as Array<{ athleteId: string; dataCollectionDate: string; statureCm: number }>)
    .filter((r) => r.athleteId === athleteId && r.statureCm > 0)
    .sort((a, b) => a.dataCollectionDate.localeCompare(b.dataCollectionDate));

  if (athleteAssessments.length >= 2) {
    const last = athleteAssessments[athleteAssessments.length - 1];
    const prev = athleteAssessments[athleteAssessments.length - 2];
    const daysDiff = (new Date(last.dataCollectionDate).getTime() - new Date(prev.dataCollectionDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff > 0) {
      const monthlyRate = ((last.statureCm - prev.statureCm) / daysDiff) * 30.44;
      if (monthlyRate >= 0.8) {
        // PHV threshold ≥ 0.8 cm/month considered rapid
        signals.push({
          kind: "growthVelocity",
          severity: monthlyRate >= 1.2 ? "warning" : "info",
          pilar: "maturation",
          message: es
            ? `Velocidad de crecimiento: +${monthlyRate.toFixed(2)} cm/mes en el último período.`
            : `Growth velocity: +${monthlyRate.toFixed(2)} cm/month in the last period.`,
          detail: es
            ? monthlyRate >= 1.2 ? "Crecimiento rápido activo — monitorizar carga de impacto." : "Crecimiento acelerado — fase sensible."
            : monthlyRate >= 1.2 ? "Active rapid growth — monitor impact loads." : "Accelerated growth — sensitive phase.",
        });
      }
    }
  }

  // ─ Offset trend: is the athlete approaching PHV? ─────────────────────────
  if (typeof offset === "number" && allLatestAssessments) {
    // Compare current offset to the band context
    const approachingPHV = offset > -1 && offset < 0 && band === "Pre-PHV";
    const enteringPHV = offset > -0.3 && offset < 0.3 && band !== "Post-PHV";
    if (enteringPHV) {
      signals.push({
        kind: "offsetTrend",
        severity: "warning",
        pilar: "maturation",
        message: es
          ? `Offset madurativo en ${offset.toFixed(2)} años — muy próximo al pico de crecimiento (PHV).`
          : `Maturity offset at ${offset.toFixed(2)} y — very close to peak height velocity (PHV).`,
        detail: es
          ? "Máxima precaución con cargas de impacto y cambios bruscos de volumen."
          : "Maximum caution with impact loads and abrupt volume changes.",
      });
    } else if (approachingPHV) {
      signals.push({
        kind: "offsetTrend",
        severity: "info",
        pilar: "maturation",
        message: es
          ? `Offset madurativo en ${offset.toFixed(2)} años — avanzando hacia el PHV.`
          : `Maturity offset at ${offset.toFixed(2)} y — advancing toward PHV.`,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PILAR 2 — RENDIMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  const testGroups = new Map<string, typeof perfEntries>();
  perfEntries.forEach((e) => {
    const g = testGroups.get(e.testName) ?? [];
    g.push(e);
    testGroups.set(e.testName, g);
  });

  testGroups.forEach((entries, testName) => {
    if (entries.length < 2) return;
    const sorted = [...entries].sort((a, b) => a.measurementDate.localeCompare(b.measurementDate));

    // ─ Last vs previous measurement ────────────────────────────────────────
    const recent = sorted.slice(-2);
    const prev = recent[0].value;
    const curr = recent[1].value;
    if (prev === 0) return;
    const lastChangePct = (curr - prev) / Math.abs(prev);
    const isNearAPHV = band === "Mid-PHV" || (typeof offset === "number" && Math.abs(offset) < 0.5);

    if (lastChangePct < -0.1) {
      if (isNearAPHV) {
        signals.push({
          kind: "growthJustified",
          severity: "info",
          pilar: "performance",
          message: es
            ? `Bajada en "${testName}" (−${Math.round(Math.abs(lastChangePct) * 100)}%) — probable impacto del pico de crecimiento.`
            : `Drop in "${testName}" (−${Math.round(Math.abs(lastChangePct) * 100)}%) — likely growth-spurt effect.`,
          detail: es ? "Esperable en esta fase madurativa." : "Expected at this maturational stage.",
        });
      } else {
        signals.push({
          kind: "perfDrop",
          severity: lastChangePct < -0.2 ? "warning" : "info",
          pilar: "performance",
          message: es
            ? `Bajada en "${testName}": −${Math.round(Math.abs(lastChangePct) * 100)}% respecto a la medición anterior.`
            : `Drop in "${testName}": −${Math.round(Math.abs(lastChangePct) * 100)}% vs. prior measurement.`,
        });
      }
    } else if (lastChangePct > 0.1) {
      signals.push({
        kind: "perfTrend",
        severity: "info",
        pilar: "performance",
        message: es
          ? `Mejora en "${testName}": +${Math.round(lastChangePct * 100)}% respecto a la medición anterior.`
          : `Improvement in "${testName}": +${Math.round(lastChangePct * 100)}% vs. prior measurement.`,
      });
    }

    // ─ Full-series trend (linear regression) — only for ≥ 3 points ─────────
    if (sorted.length >= 3) {
      const values = sorted.map((e) => e.value);
      const slope = linearTrendSlope(values);
      const baseVal = values[0] || 1;
      // Normalise slope as % change per measurement relative to first value
      const slopePct = slope / Math.abs(baseVal);

      if (Math.abs(slopePct) >= 0.04) {
        const direction = slopePct > 0 ? "up" : "down";
        const n = sorted.length;
        signals.push({
          kind: "perfTrendSeries",
          severity: "info",
          pilar: "performance",
          message: es
            ? `Tendencia en "${testName}" sobre ${n} mediciones: ${direction === "up" ? "↑ mejora" : "↓ descenso"} sostenido de ~${Math.round(Math.abs(slopePct) * 100)}% por evaluación.`
            : `Trend in "${testName}" over ${n} measurements: sustained ${direction === "up" ? "↑ improvement" : "↓ decline"} of ~${Math.round(Math.abs(slopePct) * 100)}% per session.`,
        });
      }
    }

    // ─ Percentile vs same maturity band ─────────────────────────────────────
    if (band && sorted.length > 0) {
      const athleteLatestVal = sorted[sorted.length - 1].value;
      // Gather last value of same test from other athletes in same band
      const bandPeerValues: number[] = [];
      state.athletes.forEach((peer) => {
        if (peer.id === athleteId) return;
        // We need to infer band for peer — if allLatestAssessments provided use it
        const peerBandInfo = allLatestAssessments?.find((a) => a.athleteId === peer.id);
        if (!peerBandInfo || peerBandInfo.band !== band) return;
        const peerEntries = state.performanceEntries
          .filter((e) => e.athleteId === peer.id && e.testName === testName)
          .sort((a, b) => a.measurementDate.localeCompare(b.measurementDate));
        if (peerEntries.length > 0) bandPeerValues.push(peerEntries[peerEntries.length - 1].value);
      });

      if (bandPeerValues.length >= 3) {
        const pct = percentileRank(athleteLatestVal, bandPeerValues);
        if (pct <= 20 || pct >= 80) {
          signals.push({
            kind: "perfPercentile",
            severity: "info",
            pilar: "performance",
            message: es
              ? `"${testName}": percentil ${pct} respecto a ${bandPeerValues.length} jugadores en la misma banda madurativa (${band}).`
              : `"${testName}": ${pct}th percentile vs. ${bandPeerValues.length} peers in same maturity band (${band}).`,
            detail: es
              ? pct >= 80 ? "Rendimiento destacado en su grupo madurativo." : "Por debajo de la mayoría de su grupo madurativo."
              : pct >= 80 ? "Outstanding performance within their maturity group." : "Below most peers in their maturity group.",
          });
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PILAR 3 — CARGA DE ENTRENAMIENTO
  // ═══════════════════════════════════════════════════════════════════════════

  if (loadEntries.length >= 2) {
    const sorted = [...loadEntries].sort((a, b) => a.date.localeCompare(b.date));

    // ─ ACWR: acute (last 7 days) / chronic (last 28 days) ──────────────────
    const todayMs = today.getTime();
    const acuteEntries = sorted.filter((e) => {
      const ms = new Date(e.date).getTime();
      return todayMs - ms <= 7 * 24 * 60 * 60 * 1000;
    });
    const chronicEntries = sorted.filter((e) => {
      const ms = new Date(e.date).getTime();
      return todayMs - ms <= 28 * 24 * 60 * 60 * 1000;
    });

    if (acuteEntries.length >= 1 && chronicEntries.length >= 3) {
      const acuteAvg = acuteEntries.reduce((s, e) => s + e.load, 0) / acuteEntries.length;
      const chronicAvg = chronicEntries.reduce((s, e) => s + e.load, 0) / chronicEntries.length;
      const acwr = chronicAvg > 0 ? acuteAvg / chronicAvg : 1;

      if (acwr > 1.5) {
        signals.push({
          kind: "loadACWR",
          severity: band === "Mid-PHV" ? "critical" : "warning",
          pilar: "load",
          message: es
            ? `ACWR en ${acwr.toFixed(2)} — zona de riesgo (>1.5)${band === "Mid-PHV" ? ", coincide con pico de crecimiento" : ""}.`
            : `ACWR at ${acwr.toFixed(2)} — danger zone (>1.5)${band === "Mid-PHV" ? ", coincides with peak growth" : ""}.`,
          detail: es
            ? "Ratio carga aguda (7d) / carga crónica (28d). Por encima de 1.5 aumenta significativamente el riesgo de lesión."
            : "Acute (7d) / chronic (28d) workload ratio. Above 1.5 significantly increases injury risk.",
        });
      } else if (acwr < 0.7) {
        signals.push({
          kind: "loadACWR",
          severity: "info",
          pilar: "load",
          message: es
            ? `ACWR bajo: ${acwr.toFixed(2)} — carga aguda muy inferior a la crónica. ¿Descanso intencionado o baja?`
            : `Low ACWR: ${acwr.toFixed(2)} — acute load well below chronic baseline. Intentional rest or absence?`,
        });
      } else if (acwr >= 0.8 && acwr <= 1.3) {
        signals.push({
          kind: "loadACWR",
          severity: "info",
          pilar: "load",
          message: es
            ? `ACWR óptimo: ${acwr.toFixed(2)} (zona ideal 0.8–1.3).`
            : `Optimal ACWR: ${acwr.toFixed(2)} (ideal zone 0.8–1.3).`,
        });
      }
    }

    // ─ Load spike: last 4 vs previous 4 sessions ───────────────────────────
    const last4 = sorted.slice(-4);
    const prev4 = sorted.slice(-8, -4);
    if (last4.length > 0 && prev4.length > 0) {
      const avgLast = last4.reduce((s, e) => s + e.load, 0) / last4.length;
      const avgPrev = prev4.reduce((s, e) => s + e.load, 0) / prev4.length;
      const ratio = avgPrev > 0 ? avgLast / avgPrev : 1;

      if (ratio > 1.35) {
        signals.push({
          kind: "loadSpike",
          severity: band === "Mid-PHV" ? "critical" : "warning",
          pilar: "load",
          message: es
            ? `Carga reciente +${Math.round((ratio - 1) * 100)}% sobre las 4 sesiones previas${band === "Mid-PHV" ? " — alto riesgo en pico de crecimiento" : ""}.`
            : `Recent load +${Math.round((ratio - 1) * 100)}% above prior 4-session average${band === "Mid-PHV" ? " — elevated risk at peak growth" : ""}.`,
        });
      } else if (ratio < 0.6 && last4.length >= 3) {
        signals.push({
          kind: "loadSpike",
          severity: "info",
          pilar: "load",
          message: es
            ? `Carga reciente inusualmente baja (−${Math.round((1 - ratio) * 100)}%): ¿lesión o baja voluntaria?`
            : `Recent load unusually low (−${Math.round((1 - ratio) * 100)}%): injury or intentional reduction?`,
        });
      }
    }

    // ─ Load monotony: std deviation of RPE in last 7 sessions ──────────────
    const last7 = sorted.slice(-7);
    if (last7.length >= 4) {
      const rpes = last7.map((e) => e.rpe);
      const meanRpe = rpes.reduce((s, v) => s + v, 0) / rpes.length;
      const stdRpe = Math.sqrt(rpes.reduce((s, v) => s + (v - meanRpe) ** 2, 0) / rpes.length);
      const monotony = meanRpe > 0 ? meanRpe / (stdRpe || 0.001) : 0;
      if (monotony > 2.0) {
        signals.push({
          kind: "loadMonotony",
          severity: "warning",
          pilar: "load",
          message: es
            ? `Monotonía de carga alta (índice ${monotony.toFixed(1)}) — RPE muy uniforme en las últimas sesiones. Riesgo de sobreentrenamiento acumulado.`
            : `High training monotony (index ${monotony.toFixed(1)}) — very uniform RPE across recent sessions. Risk of accumulated overtraining.`,
          detail: es
            ? "Variar la intensidad entre sesiones reduce este riesgo."
            : "Varying intensity between sessions reduces this risk.",
        });
      }
    }

    // ─ Compare load with team average ──────────────────────────────────────
    const teamId = state.athletes.find((a) => a.id === athleteId)?.teamId;
    if (teamId) {
      const teammates = state.athletes.filter((a) => a.teamId === teamId && a.id !== athleteId).map((a) => a.id);
      const recentDates = new Set(last4.map((e) => e.date));
      const teamLoads = state.trainingLoadEntries.filter(
        (e) => teammates.includes(e.athleteId) && recentDates.has(e.date),
      );
      if (teamLoads.length > 2) {
        const athleteAvg = last4.reduce((s, e) => s + e.load, 0) / Math.max(1, last4.length);
        const teamAvg = teamLoads.reduce((s, e) => s + e.load, 0) / teamLoads.length;
        const vsTeam = teamAvg > 0 ? athleteAvg / teamAvg : 1;
        if (vsTeam > 1.3) {
          signals.push({
            kind: "loadHighVsTeam",
            severity: band === "Mid-PHV" ? "warning" : "info",
            pilar: "load",
            message: es
              ? `Carga ${Math.round((vsTeam - 1) * 100)}% superior a la media del equipo en las últimas sesiones.`
              : `Load ${Math.round((vsTeam - 1) * 100)}% above team average over recent sessions.`,
          });
        } else if (vsTeam < 0.7) {
          signals.push({
            kind: "loadHighVsTeam",
            severity: "info",
            pilar: "load",
            message: es
              ? `Carga ${Math.round((1 - vsTeam) * 100)}% inferior a la media del equipo en las últimas sesiones.`
              : `Load ${Math.round((1 - vsTeam) * 100)}% below team average over recent sessions.`,
          });
        }
      }
    }

    // ─ Compare load with same maturity band ────────────────────────────────
    if (band && allLatestAssessments) {
      const bandPeerIds = allLatestAssessments
        .filter((a) => a.athleteId !== athleteId && a.band === band)
        .map((a) => a.athleteId);
      if (bandPeerIds.length >= 2) {
        const recentDates = new Set(last4.map((e) => e.date));
        const bandLoads = state.trainingLoadEntries.filter(
          (e) => bandPeerIds.includes(e.athleteId) && recentDates.has(e.date),
        );
        if (bandLoads.length >= 2) {
          const athleteAvg = last4.reduce((s, e) => s + e.load, 0) / Math.max(1, last4.length);
          const bandAvg = bandLoads.reduce((s, e) => s + e.load, 0) / bandLoads.length;
          const vsBand = bandAvg > 0 ? athleteAvg / bandAvg : 1;
          if (vsBand > 1.3) {
            signals.push({
              kind: "loadHighVsTeam",
              severity: band === "Mid-PHV" ? "warning" : "info",
              pilar: "load",
              message: es
                ? `Carga ${Math.round((vsBand - 1) * 100)}% superior a jugadores de su misma banda madurativa (${band}).`
                : `Load ${Math.round((vsBand - 1) * 100)}% above peers in the same maturity band (${band}).`,
            });
          }
        }
      }
    }
  }

  return signals;
}

// ── Pilar-level status helper ────────────────────────────────────────────────
type PilarStatus = "ok" | "warning" | "critical";

function getPilarStatus(pilar: "maturation" | "performance" | "load", signals: InsightSignal[], alerts: AlertItem[]): PilarStatus {
  // Critical alerts map to pilars via category
  const alertPilarMap: Record<string, "maturation" | "performance" | "load"> = {
    highACWR: "load",
    highLoad: "load",
    rapidGrowth: "maturation",
    performanceDrop: "performance",
  };
  for (const a of alerts) {
    if (a.severity === "critical" && alertPilarMap[a.category] === pilar) return "critical";
  }
  for (const s of signals) {
    if (s.pilar === pilar && s.severity === "critical") return "critical";
  }
  for (const a of alerts) {
    if (a.severity === "warning" && alertPilarMap[a.category] === pilar) return "warning";
  }
  for (const s of signals) {
    if (s.pilar === pilar && s.severity === "warning") return "warning";
  }
  const hasInfo = signals.some((s) => s.pilar === pilar && s.severity === "info");
  return hasInfo ? "ok" : "ok";
}

// ── Athlete card inside SmartAlertsView ──────────────────────────────────────

function SmartAthleteCard({
  status,
  signals,
  locale,
  urgency,
}: {
  status: {
    id: string;
    name: string;
    team?: string;
    band: MaturityBand | null;
    offset: number;
    age: number;
    alerts: AlertItem[];
  };
  signals: InsightSignal[];
  locale: string;
  urgency: UrgencyLevel;
}) {
  const [expanded, setExpanded] = useState(false);
  const es = locale === "es";

  // ── Pilar semaphores ──────────────────────────────────────────────────────
  const pilarStatuses = {
    maturation: getPilarStatus("maturation", signals, status.alerts),
    performance: getPilarStatus("performance", signals, status.alerts),
    load: getPilarStatus("load", signals, status.alerts),
  };

  const semaphoreColor = (st: PilarStatus) =>
    st === "critical" ? "bg-rose-500 ring-rose-300"
    : st === "warning" ? "bg-amber-400 ring-amber-200"
    : "bg-teal-400 ring-teal-200";

  const pilarDots: { key: "maturation" | "performance" | "load"; labelEs: string; labelEn: string }[] = [
    { key: "maturation", labelEs: "Mad", labelEn: "Mat" },
    { key: "performance", labelEs: "Rend", labelEn: "Perf" },
    { key: "load", labelEs: "Carga", labelEn: "Load" },
  ];

  // ── Urgency visuals ───────────────────────────────────────────────────────
  const urgencyBorderColor =
    urgency === "critical" ? "border-rose-300 bg-rose-50/40"
    : urgency === "warning" ? "border-amber-300 bg-amber-50/40"
    : urgency === "monitoring" ? "border-amber-200 bg-amber-50/20"
    : "border-slate-200 bg-white";

  const urgencyDot =
    urgency === "critical" ? "bg-rose-500 animate-pulse"
    : urgency === "warning" ? "bg-amber-400"
    : urgency === "monitoring" ? "bg-amber-300"
    : "bg-teal-400";

  // ── Issue lists ───────────────────────────────────────────────────────────
  const criticalAlerts = status.alerts.filter((a) => a.severity === "critical");
  const warningAlerts  = status.alerts.filter((a) => a.severity === "warning");
  const critSignals    = signals.filter((s) => s.severity === "critical");
  const warnSignals    = signals.filter((s) => s.severity === "warning");

  const topIssues = [
    ...criticalAlerts.map((a) => ({ text: a.message, detail: a.detail, sev: "critical" as const })),
    ...warningAlerts.map((a)  => ({ text: a.message, detail: a.detail, sev: "warning" as const })),
    ...critSignals.map((s)    => ({ text: s.message, detail: s.detail, sev: "critical" as const })),
    ...warnSignals.map((s)    => ({ text: s.message, detail: s.detail, sev: "warning" as const })),
  ];

  // ── Info signals grouped by pilar ─────────────────────────────────────────
  const infoByPilar = {
    maturation:  signals.filter((s) => s.severity === "info" && s.pilar === "maturation"),
    performance: signals.filter((s) => s.severity === "info" && s.pilar === "performance"),
    load:        signals.filter((s) => s.severity === "info" && s.pilar === "load"),
  };

  const pilarConfig = [
    {
      key: "maturation" as const,
      label: es ? "Maduración" : "Maturation",
      icon: <Activity className="h-3 w-3 text-violet-500" />,
      headerClass: "text-violet-600",
      itemClass: "bg-violet-50 border-violet-100",
      textClass: "text-violet-800",
      detailClass: "text-violet-600",
    },
    {
      key: "performance" as const,
      label: es ? "Rendimiento" : "Performance",
      icon: <TrendingUp className="h-3 w-3 text-teal-500" />,
      headerClass: "text-teal-600",
      itemClass: "bg-teal-50 border-teal-100",
      textClass: "text-teal-800",
      detailClass: "text-teal-600",
    },
    {
      key: "load" as const,
      label: es ? "Carga" : "Load",
      icon: <BarChart2 className="h-3 w-3 text-blue-500" />,
      headerClass: "text-blue-600",
      itemClass: "bg-blue-50 border-blue-100",
      textClass: "text-blue-800",
      detailClass: "text-blue-600",
    },
  ];

  const hasAnyContent = topIssues.length > 0 || Object.values(infoByPilar).some((arr) => arr.length > 0);

  // Worst severity badge for the header
  const worstBadge =
    urgency === "critical" ? { label: es ? "Crítico" : "Critical", cls: "bg-rose-100 text-rose-700" }
    : urgency === "warning"  ? { label: es ? "Aviso" : "Warning",   cls: "bg-amber-100 text-amber-700" }
    : urgency === "monitoring" ? { label: es ? "Seguim." : "Monitor", cls: "bg-amber-50 text-amber-600" }
    : null;

  // Band recommendation content
  const bandRec =
    status.band === "Mid-PHV"  ? (es ? "Pico de crecimiento: priorizar técnica y coordinación, limitar cargas de impacto." : "Peak growth phase: prioritise technique and coordination, limit impact loads.")
    : status.band === "Pre-PHV"  ? (es ? "Ventana sensible para habilidades motoras y coordinación multilateral." : "Sensitive window for motor skills and multilateral coordination.")
    : status.band === "Post-PHV" ? (es ? "Introducir progresivamente cargas de fuerza y trabajo de potencia." : "Progressively introduce strength and power loads.")
    : null;

  return (
    <>
      {/* ── ROW (list item — click opens modal) ── */}
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={`w-full rounded-2xl border shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 text-left ${urgencyBorderColor}`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Urgency dot */}
          <span className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${urgencyDot}`} />

          {/* Avatar */}
          <span className={`flex-shrink-0 h-8 w-8 rounded-full text-sm font-black flex items-center justify-center ${
            urgency === "critical" ? "bg-rose-200 text-rose-800"
            : urgency === "warning" ? "bg-amber-200 text-amber-800"
            : "bg-slate-200 text-slate-700"
          }`}>
            {status.name.charAt(0).toUpperCase()}
          </span>

          {/* Name + meta */}
          <div className="min-w-0 flex-1">
            <p className="font-bold text-slate-900 text-sm truncate">{status.name}</p>
            <p className="text-[11px] text-slate-500 truncate">
              {status.team} · {formatNumber(status.age, 1)} {es ? "a" : "y"}
            </p>
          </div>

          {/* Right: pilar semaphores + band + worst badge + arrow */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-full px-2.5 py-1">
              {pilarDots.map(({ key, labelEs, labelEn }) => (
                <div key={key} className="flex flex-col items-center gap-0.5">
                  <span className={`h-2 w-2 rounded-full ring-2 ring-offset-0 ${semaphoreColor(pilarStatuses[key])}`} />
                  <span className="text-[8px] font-semibold text-slate-400 leading-none">{es ? labelEs : labelEn}</span>
                </div>
              ))}
            </div>
            {status.band && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getBandChipSA(status.band)}`}>
                {bandLabelSA(status.band, locale)}
              </span>
            )}
            {worstBadge && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${worstBadge.cls}`}>
                {worstBadge.label}
              </span>
            )}
            <ChevronRight className="h-4 w-4 text-slate-300" />
          </div>
        </div>
      </button>

      {/* ── MODAL ── */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`athlete-modal-${status.id}`}
          onKeyDown={(e) => { if (e.key === "Escape") setExpanded(false); }}
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label={es ? "Cerrar" : "Close"}
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setExpanded(false)}
          />

          {/* Panel */}
          <div className="relative w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl">

            {/* Modal header */}
            <div className={`sticky top-0 z-10 flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-white rounded-t-3xl sm:rounded-t-2xl ${
              urgency === "critical" ? "border-rose-200 bg-rose-50/60"
              : urgency === "warning" ? "border-amber-200 bg-amber-50/60"
              : ""
            }`}>
              <span className={`flex-shrink-0 h-2.5 w-2.5 rounded-full ${urgencyDot}`} />
              <span className={`flex-shrink-0 h-9 w-9 rounded-full text-sm font-black flex items-center justify-center ${
                urgency === "critical" ? "bg-rose-200 text-rose-800"
                : urgency === "warning" ? "bg-amber-200 text-amber-800"
                : "bg-slate-200 text-slate-700"
              }`}>
                {status.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p id={`athlete-modal-${status.id}`} className="font-bold text-slate-900 truncate">{status.name}</p>
                <p className="text-xs text-slate-500">{status.team} · {formatNumber(status.age, 1)} {es ? "años" : "y"}</p>
              </div>
              {status.band && (
                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${getBandChipSA(status.band)}`}>
                  {bandLabelSA(status.band, locale)}
                </span>
              )}
              <button
                type="button"
                onClick={() => setExpanded(false)}
                className="flex-shrink-0 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                aria-label={es ? "Cerrar" : "Close"}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Pilar semaphores bar */}
            <div className="flex items-center gap-0 divide-x divide-slate-100 border-b border-slate-100">
              {pilarDots.map(({ key, labelEs, labelEn }) => {
                const st = pilarStatuses[key];
                const dotCls = st === "critical" ? "bg-rose-500" : st === "warning" ? "bg-amber-400" : "bg-teal-400";
                const bgCls  = st === "critical" ? "bg-rose-50"  : st === "warning" ? "bg-amber-50"  : "bg-white";
                return (
                  <div key={key} className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 ${bgCls}`}>
                    <span className={`h-2.5 w-2.5 rounded-full ${dotCls}`} />
                    <span className="text-[11px] font-semibold text-slate-600">{es ? labelEs : labelEn}</span>
                  </div>
                );
              })}
            </div>

            {/* Modal body */}
            <div className="divide-y divide-slate-100">

              {/* Band recommendation */}
              {bandRec && (
                <div className="px-5 py-3 flex items-start gap-2 bg-slate-50">
                  <Target className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <p className="text-[12px] text-slate-600 leading-relaxed">{bandRec}</p>
                </div>
              )}

              {/* Critical + warning alerts */}
              {topIssues.length > 0 && (
                <div className="px-5 py-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {es ? "Alertas activas" : "Active alerts"}
                  </p>
                  {topIssues.map((issue, i) => (
                    <div key={i} className={`flex gap-2 items-start rounded-xl p-3 ${
                      issue.sev === "critical" ? "bg-rose-50 border border-rose-100" : "bg-amber-50 border border-amber-100"
                    }`}>
                      {issue.sev === "critical"
                        ? <AlertTriangle className="h-4 w-4 text-rose-500 mt-0.5 flex-shrink-0" />
                        : <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                      }
                      <div>
                        <p className={`text-sm font-semibold ${issue.sev === "critical" ? "text-rose-800" : "text-amber-900"}`}>{issue.text}</p>
                        {issue.detail && <p className={`text-xs mt-0.5 ${issue.sev === "critical" ? "text-rose-600" : "text-amber-700"}`}>{issue.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Info signals per pilar */}
              {pilarConfig.map((pilar) => {
                const items = infoByPilar[pilar.key];
                if (items.length === 0) return null;
                return (
                  <div key={pilar.key} className="px-5 py-4 space-y-2">
                    <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 mb-2 ${pilar.headerClass}`}>
                      {pilar.icon}
                      {pilar.label}
                    </p>
                    {items.map((sig, i) => (
                      <div key={i} className={`flex gap-2 items-start rounded-xl p-3 border ${pilar.itemClass}`}>
                        <Info className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                          sig.kind === "perfTrend" || sig.kind === "perfTrendSeries" ? "text-teal-400"
                          : sig.kind === "loadACWR" || sig.kind === "loadMonotony" ? "text-blue-400"
                          : sig.kind === "growthVelocity" || sig.kind === "offsetTrend" ? "text-violet-400"
                          : "text-slate-400"
                        }`} />
                        <div>
                          <p className={`text-sm leading-relaxed ${pilar.textClass}`}>{sig.message}</p>
                          {sig.detail && <p className={`text-xs mt-0.5 ${pilar.detailClass}`}>{sig.detail}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {/* All-clear */}
              {!hasAnyContent && (
                <div className="px-5 py-6 flex flex-col items-center gap-2 text-slate-400">
                  <CheckCircle2 className="h-8 w-8 text-teal-400" />
                  <p className="text-sm font-medium">{es ? "Sin señales activas." : "No active signals."}</p>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main AssistantView (new design) ─────────────────────────────────────────

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
  const es = locale === "es";
  const { selectedEngine, bioBandingStrategy } = useMaturationPreferences();

  // Navigation state: null = team list, string = selected team
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  // Urgency filter
  type UrgencyFilter = "all" | "critical" | "warning" | "monitoring";
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");

  // Resolve latest assessments with engine profiles
  const latestEngineResolved = useMemo(
    () =>
      getLatestAssessmentsByAthlete(assessments).map((assessment) => {
        const athleteSex = resolveAssessmentSex(assessment, state.athletes);
        const profile = createUnifiedProfile(assessment, selectedEngine, bioBandingStrategy, athleteSex);
        return {
          ...assessment,
          classification: {
            ...assessment.classification,
            maturityBand: getGroupingBand(profile),
            primaryOffset: profile.offset ?? assessment.classification.primaryOffset,
          },
        };
      }),
    [assessments, selectedEngine, bioBandingStrategy, state.athletes],
  );

  const alertItems = useMemo(() => buildAlerts(latestEngineResolved), [latestEngineResolved]);
  const rapidGrowthItems = useMemo(() => detectRapidGrowth(assessments), [assessments]);

  // Build athlete status map
  const allAthleteStatus = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      team: string;
      band: MaturityBand | null;
      offset: number;
      age: number;
      alerts: AlertItem[];
    }>();

    latestEngineResolved.forEach((a) => {
      const band = a.classification.maturityBand;
      const baseAlerts = alertItems.filter((al) => al.athleteName === a.inputs.athleteName);
      map.set(a.inputs.athleteId, {
        id: a.inputs.athleteId,
        name: a.inputs.athleteName,
        team: a.inputs.teamName ?? "",
        band,
        offset: a.classification.primaryOffset,
        age: a.derivedMetrics.chronologicalAge,
        alerts: [...baseAlerts],
      });
    });

    rapidGrowthItems.forEach((rg) => {
      const entry = map.get(rg.athleteId);
      if (entry) {
        entry.alerts.push({
          id: rg.id,
          severity: "warning",
          athleteName: rg.athleteName,
          teamName: rg.teamName,
          category: "rapidGrowth",
          message: t("analysis.assistant.rapidGrowth") + `: +${formatNumber(rg.statureGain, 2)}cm`,
          detail: t("analysis.assistant.rapidGrowthDetail").replace("{rate}", formatNumber(rg.monthlyRate, 2)),
        });
      }
    });

    return Array.from(map.values());
  }, [latestEngineResolved, alertItems, rapidGrowthItems, t]);

  // Band context for all athletes — used by buildEnrichedSignals for cross-athlete comparisons
  const allLatestAssessmentsForSignals = useMemo(() =>
    allAthleteStatus.map((a) => ({ athleteId: a.id, band: a.band, offset: a.offset })),
  [allAthleteStatus]);

  // Teams list with per-pilar worst status
  const allTeams = useMemo(() => {
    const teams = new Map<string, {
      name: string; count: number; critCount: number; warnCount: number;
      pilarWorst: { maturation: PilarStatus; performance: PilarStatus; load: PilarStatus };
    }>();
    allAthleteStatus.forEach((a) => {
      const key = a.team || (es ? "Sin equipo" : "No team");
      const signals = buildEnrichedSignals(a.id, a.band, a.offset, state, locale, allLatestAssessmentsForSignals);
      const urgency = getUrgencyLevel(a.alerts, a.band, signals);
      const athletePilar = {
        maturation: getPilarStatus("maturation", signals, a.alerts),
        performance: getPilarStatus("performance", signals, a.alerts),
        load: getPilarStatus("load", signals, a.alerts),
      };
      const existing = teams.get(key) ?? {
        name: key, count: 0, critCount: 0, warnCount: 0,
        pilarWorst: { maturation: "ok" as PilarStatus, performance: "ok" as PilarStatus, load: "ok" as PilarStatus },
      };
      existing.count++;
      if (urgency === "critical") existing.critCount++;
      else if (urgency === "warning" || urgency === "monitoring") existing.warnCount++;
      // Escalate pilar worst
      const escalate = (curr: PilarStatus, next: PilarStatus): PilarStatus =>
        next === "critical" ? "critical" : next === "warning" && curr !== "critical" ? "warning" : curr;
      existing.pilarWorst.maturation  = escalate(existing.pilarWorst.maturation,  athletePilar.maturation);
      existing.pilarWorst.performance = escalate(existing.pilarWorst.performance, athletePilar.performance);
      existing.pilarWorst.load        = escalate(existing.pilarWorst.load,        athletePilar.load);
      teams.set(key, existing);
    });
    return Array.from(teams.values()).sort((a, b) => b.critCount - a.critCount || b.warnCount - a.warnCount);
  }, [allAthleteStatus, es, state, locale, allLatestAssessmentsForSignals]);

  // Athletes in selected team, filtered + sorted
  // "__all__" is a special key meaning cross-team urgency view
  const teamAthletes = useMemo(() => {
    const athletes = !selectedTeam
      ? allAthleteStatus
      : selectedTeam === "__all__"
      ? allAthleteStatus
      : allAthleteStatus.filter((a) => (a.team || (es ? "Sin equipo" : "No team")) === selectedTeam);

    return athletes
      .filter((a) => {
        if (urgencyFilter === "all") return true;
        const u = getUrgencyLevel(a.alerts, a.band);
        return u === urgencyFilter;
      })
      .sort((a, b) => urgencyOrder(getUrgencyLevel(a.alerts, a.band)) - urgencyOrder(getUrgencyLevel(b.alerts, b.band)));
  }, [allAthleteStatus, selectedTeam, urgencyFilter, es]);

  // Summary counts
  const criticalCount = allAthleteStatus.reduce((s, a) => s + a.alerts.filter((al) => al.severity === "critical").length, 0);
  const warningCount = allAthleteStatus.filter((a) => getUrgencyLevel(a.alerts, a.band) === "warning").length;
  const monitoringCount = allAthleteStatus.filter((a) => getUrgencyLevel(a.alerts, a.band) === "monitoring").length;

  const urgencyLabels: Record<UrgencyFilter, string> = {
    all: es ? "Todos" : "All",
    critical: es ? "Crítico" : "Critical",
    warning: es ? "Aviso" : "Warning",
    monitoring: es ? "Seguimiento" : "Monitoring",
  };

  return (
    <div className="space-y-5">

      {/* ── SUMMARY BANNER ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-slate-800">
            {allAthleteStatus.length === 0
              ? (es ? "Sin atletas evaluados todavía." : "No athletes assessed yet.")
              : criticalCount > 0
              ? (es ? `${criticalCount} alerta${criticalCount > 1 ? "s" : ""} crítica${criticalCount > 1 ? "s" : ""} — revisión inmediata necesaria.` : `${criticalCount} critical alert${criticalCount > 1 ? "s" : ""} — immediate review required.`)
              : warningCount > 0 || monitoringCount > 0
              ? (es ? `${warningCount} aviso${warningCount !== 1 ? "s" : ""} activo${warningCount !== 1 ? "s" : ""} · ${monitoringCount} en seguimiento.` : `${warningCount} active warning${warningCount !== 1 ? "s" : ""} · ${monitoringCount} under monitoring.`)
              : (es ? `Todo en orden · ${allAthleteStatus.length} atletas evaluados.` : `All clear · ${allAthleteStatus.length} athletes assessed.`)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 border border-rose-200 px-2.5 py-1 text-[11px] font-bold text-rose-700">
            <AlertTriangle className="h-3 w-3" />{criticalCount} {es ? "crítico" : "critical"}{criticalCount !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-700">
            <AlertCircle className="h-3 w-3" />{warningCount} {es ? "aviso" : "warning"}{warningCount !== 1 ? "s" : ""}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-1 text-[11px] font-bold text-amber-600">
            <Zap className="h-3 w-3" />{monitoringCount} {es ? "seguim." : "monitor"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-600">
            <Users className="h-3 w-3" />{allAthleteStatus.length} {es ? "atletas" : "athletes"}
          </span>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700 transition-colors no-print"
        >
          <Download className="h-3.5 w-3.5" />PDF
        </button>
      </div>

      {/* ── URGENCY QUICK-ACCESS ── */}
      {selectedTeam === null && (criticalCount > 0 || warningCount > 0 || monitoringCount > 0) && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
            {es ? "Acceso rápido por urgencia" : "Quick access by urgency"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {criticalCount > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedTeam("__all__"); setUrgencyFilter("critical"); }}
                className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-left hover:bg-rose-100 transition-all hover:shadow-sm"
              >
                <span className="flex-shrink-0 h-9 w-9 rounded-xl bg-rose-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                </span>
                <div>
                  <p className="text-sm font-bold text-rose-800">{criticalCount} {es ? "crítico" : "critical"}{criticalCount !== 1 ? "s" : ""}</p>
                  <p className="text-[11px] text-rose-500">{es ? "Revisión inmediata" : "Immediate review"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-rose-300 ml-auto" />
              </button>
            )}
            {warningCount > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedTeam("__all__"); setUrgencyFilter("warning"); }}
                className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100 transition-all hover:shadow-sm"
              >
                <span className="flex-shrink-0 h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </span>
                <div>
                  <p className="text-sm font-bold text-amber-800">{warningCount} {es ? "aviso" : "warning"}{warningCount !== 1 ? "s" : ""}</p>
                  <p className="text-[11px] text-amber-500">{es ? "Requieren atención" : "Require attention"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-300 ml-auto" />
              </button>
            )}
            {monitoringCount > 0 && (
              <button
                type="button"
                onClick={() => { setSelectedTeam("__all__"); setUrgencyFilter("monitoring"); }}
                className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 px-4 py-3 text-left hover:bg-amber-100/60 transition-all hover:shadow-sm"
              >
                <span className="flex-shrink-0 h-9 w-9 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-amber-500" />
                </span>
                <div>
                  <p className="text-sm font-bold text-amber-700">{monitoringCount} {es ? "seguimiento" : "monitoring"}</p>
                  <p className="text-[11px] text-amber-400">{es ? "Mid-PHV activos" : "Active Mid-PHV"}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-amber-200 ml-auto" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── TEAM LIST (if no team selected) ── */}
      {selectedTeam === null ? (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 px-1">
            {es ? "Selecciona un equipo o grupo" : "Select a team or group"}
          </h2>
          {allTeams.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl gap-2">
              <Users size={32} className="opacity-20" />
              <p className="text-sm font-medium">{es ? "Sin datos disponibles." : "No data available."}</p>
            </div>
          ) : (
            allTeams.map((team) => (
              <button
                key={team.name}
                type="button"
                onClick={() => setSelectedTeam(team.name)}
                className="w-full flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-left group"
              >
                <div className={`flex-shrink-0 h-10 w-10 rounded-xl flex items-center justify-center ${
                  team.critCount > 0 ? "bg-rose-100 text-rose-700" : team.warnCount > 0 ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"
                }`}>
                  <Users className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 group-hover:text-teal-700 transition-colors">{team.name}</p>
                  <p className="text-xs text-slate-400">{team.count} {es ? "atleta" : "athlete"}{team.count !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Per-pilar semaphores for the team */}
                  <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                    {(["maturation", "performance", "load"] as const).map((pilar) => {
                      const st = team.pilarWorst[pilar];
                      const dotCls = st === "critical" ? "bg-rose-500 ring-rose-300" : st === "warning" ? "bg-amber-400 ring-amber-200" : "bg-teal-400 ring-teal-200";
                      const labelMap: Record<typeof pilar, string> = es
                        ? { maturation: "Mad", performance: "Rend", load: "Carga" }
                        : { maturation: "Mat", performance: "Perf", load: "Load" };
                      return (
                        <div key={pilar} className="flex flex-col items-center gap-0.5">
                          <span className={`h-2.5 w-2.5 rounded-full ring-2 ring-offset-0 ${dotCls}`} />
                          <span className="text-[8px] font-semibold text-slate-400 leading-none">{labelMap[pilar]}</span>
                        </div>
                      );
                    })}
                  </div>
                  {team.critCount > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-rose-100 text-rose-700 px-2 py-0.5 text-[11px] font-bold">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse inline-block" />
                      {team.critCount}
                    </span>
                  )}
                  {team.warnCount > 0 && (
                    <span className="rounded-full bg-amber-100 text-amber-700 px-2 py-0.5 text-[11px] font-bold">
                      {team.warnCount}⚠
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 transition-colors" />
                </div>
              </button>
            ))
          )}
        </div>
      ) : (
        /* ── PLAYER LIST for selected team ── */
        <div className="space-y-4">

          {/* Back + team header */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setSelectedTeam(null); setUrgencyFilter("all"); }}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors no-print"
            >
              <ArrowLeft className="h-4 w-4" />
              {es ? "Inicio" : "Home"}
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-slate-800">
              {selectedTeam === "__all__"
                ? (urgencyFilter === "critical" ? (es ? "Críticos" : "Critical")
                  : urgencyFilter === "warning"  ? (es ? "Avisos" : "Warnings")
                  : urgencyFilter === "monitoring" ? (es ? "Seguimiento" : "Monitoring")
                  : (es ? "Todos los jugadores" : "All players"))
                : selectedTeam}
            </span>
            <span className="ml-1 text-xs text-slate-400">
              {teamAthletes.length} {es ? "jugador" : "player"}{teamAthletes.length !== 1 ? "es" : ""}
            </span>
          </div>

          {/* Urgency filter bar */}
          <div className="flex flex-wrap items-center gap-2 no-print">
            <span className="text-xs font-semibold text-slate-400">{es ? "Filtrar por urgencia:" : "Filter by urgency:"}</span>
            {(["all", "critical", "warning", "monitoring"] as UrgencyFilter[]).map((level) => {
              const teamPool = selectedTeam === "__all__"
                ? allAthleteStatus
                : allAthleteStatus.filter((a) => (a.team || (es ? "Sin equipo" : "No team")) === selectedTeam);
              const counts: Record<UrgencyFilter, number> = {
                all: teamPool.length,
                critical: teamPool.filter((a) => getUrgencyLevel(a.alerts, a.band) === "critical").length,
                warning:  teamPool.filter((a) => getUrgencyLevel(a.alerts, a.band) === "warning").length,
                monitoring: teamPool.filter((a) => getUrgencyLevel(a.alerts, a.band) === "monitoring").length,
              };
              const active = urgencyFilter === level;
              const colorActive =
                level === "critical" ? "bg-rose-600 text-white border-rose-600"
                : level === "warning" ? "bg-amber-500 text-white border-amber-500"
                : level === "monitoring" ? "bg-amber-200 text-amber-800 border-amber-300"
                : "bg-teal-600 text-white border-teal-600";
              const colorIdle =
                level === "critical" ? "border-rose-200 text-rose-700 hover:bg-rose-50"
                : level === "warning" ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                : level === "monitoring" ? "border-amber-200 text-amber-600 hover:bg-amber-50"
                : "border-slate-200 text-slate-600 hover:bg-slate-50";
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => setUrgencyFilter(level)}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold transition-colors ${active ? colorActive : `bg-white ${colorIdle}`}`}
                >
                  {urgencyLabels[level]}
                  <span className={`rounded-full px-1.5 py-0 text-[10px] font-black ${active ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
                    {counts[level]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Athlete cards */}
          {teamAthletes.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl gap-2">
              <Shield size={32} className="opacity-20" />
              <p className="text-sm font-medium">
                {es ? "Ningún jugador coincide con este filtro." : "No players match this filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {teamAthletes.map((athlete) => {
                const signals = buildEnrichedSignals(athlete.id, athlete.band, athlete.offset, state, locale, allLatestAssessmentsForSignals);
                const urgency = getUrgencyLevel(athlete.alerts, athlete.band, signals);
                return (
                  <SmartAthleteCard
                    key={athlete.id}
                    status={athlete}
                    signals={signals}
                    locale={locale}
                    urgency={urgency}
                  />
                );
              })}
            </div>
          )}
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