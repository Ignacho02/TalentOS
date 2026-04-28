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
import type { MaturityBand } from "@/lib/types";
import type { TeamStats, AlertItem, RapidGrowthAlert } from "@/lib/maturation/analysis-helpers";

const bandColors: Record<string, string> = {
  "Pre-PHV": "#0f766e",
  "Mid-PHV": "#b45309",
  "Post-PHV": "#0f172a",
};

type AnalysisTab = "individual" | "collective" | "assistant";

// ---------------------------------------------------------------------------
// Tab selector
// ---------------------------------------------------------------------------
function TabBar({
  active,
  onChange,
  labels,
}: {
  active: AnalysisTab;
  onChange: (t: AnalysisTab) => void;
  labels: Record<AnalysisTab, string>;
}) {
  const tabs: AnalysisTab[] = ["individual", "collective", "assistant"];
  const icons: Record<AnalysisTab, React.ReactNode> = {
    individual: <Users className="h-4 w-4" />,
    collective: <Group className="h-4 w-4" />,
    assistant: <Activity className="h-4 w-4" />,
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 no-print">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`flex items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-medium transition-all whitespace-nowrap ${
            active === tab
              ? "border-teal-600 bg-teal-600 text-white shadow-sm"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          {icons[tab]}
          {labels[tab]}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// INDIVIDUAL TAB
// ---------------------------------------------------------------------------
function IndividualView({
  assessments,
  state,
  t,
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
}) {
  const teams = useMemo(
    () => [...new Set(state.athletes.map((a) => a.teamName).filter(Boolean))] as string[],
    [state.athletes],
  );

  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterBand, setFilterBand] = useState("");
  const [selectedAthleteId, setSelectedAthleteId] = useState(state.athletes[0]?.id ?? "");

  const latestByAthlete = useMemo(() => {
    const map = new Map<string, (typeof assessments)[number]>();
    for (const a of assessments) {
      const existing = map.get(a.inputs.athleteId);
      if (!existing || existing.inputs.dataCollectionDate < a.inputs.dataCollectionDate) {
        map.set(a.inputs.athleteId, a);
      }
    }
    return Array.from(map.values());
  }, [assessments]);

  const filtered = useMemo(() => {
    return latestByAthlete.filter((a) => {
      if (search && !a.inputs.athleteName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterTeam && a.inputs.teamName !== filterTeam) return false;
      if (filterBand && a.classification.maturityBand !== filterBand) return false;
      return true;
    });
  }, [latestByAthlete, search, filterTeam, filterBand]);

  const selectedLatest = latestByAthlete.find((a) => a.inputs.athleteId === selectedAthleteId) ?? latestByAthlete[0];

  const selectedHistory = useMemo(
    () =>
      assessments
        .filter((a) => a.inputs.athleteId === selectedAthleteId)
        .sort((a, b) => a.inputs.dataCollectionDate.localeCompare(b.inputs.dataCollectionDate)),
    [assessments, selectedAthleteId],
  );

  // Z-score within team
  const teamAssessments = useMemo(
    () => assessments.filter((a) => a.inputs.teamName === selectedLatest?.inputs.teamName),
    [assessments, selectedLatest],
  );
  
  // Maturation group assessments
  const groupAssessments = useMemo(
    () => assessments.filter((a) => a.classification.maturityBand === selectedLatest?.classification.maturityBand),
    [assessments, selectedLatest],
  );

  const zScoreInfo = selectedLatest ? computeAthleteZScore(selectedLatest, teamAssessments) : null;

  // Performance data for selected athlete
  const athletePerformance = useMemo(() => {
    return state.performanceEntries.filter(e => e.athleteId === selectedAthleteId);
  }, [state.performanceEntries, selectedAthleteId]);

  // Training load data for selected athlete
  const athleteLoad = useMemo(() => {
    return state.trainingLoadEntries
      .filter(e => e.athleteId === selectedAthleteId)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [state.trainingLoadEntries, selectedAthleteId]);

  // Team comparison data
  const teamComparisonData = useMemo(() => {
    if (!zScoreInfo) return [];
    const teammates = teamAssessments.filter((a) => a.inputs.athleteId !== selectedAthleteId);
    return [
      { name: selectedLatest.inputs.athleteName, offset: selectedLatest.classification.primaryOffset, highlight: true },
      ...teammates.map((a) => ({ name: a.inputs.athleteName, offset: a.classification.primaryOffset, highlight: false })),
    ].sort((a, b) => a.offset - b.offset);
  }, [selectedLatest, teamAssessments, selectedAthleteId, zScoreInfo]);

  // Group comparison (Mean offset)
  const groupMeanOffset = useMemo(() => {
    if (groupAssessments.length === 0) return 0;
    return groupAssessments.reduce((acc, a) => acc + a.classification.primaryOffset, 0) / groupAssessments.length;
  }, [groupAssessments]);

  if (latestByAthlete.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
        <Users size={48} className="mb-4 opacity-20" />
        <p>{t("analysis.individual.noDataSelected")}</p>
      </div>
    );
  }

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Filters row */}
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

      {/* Athlete selector cards */}
      <div className="flex gap-3 overflow-x-auto pb-2 no-print">
        {filtered.map((a) => (
          <button
            key={a.inputs.athleteId}
            onClick={() => setSelectedAthleteId(a.inputs.athleteId)}
            className={`flex-shrink-0 flex items-center gap-3 p-3 rounded-xl border transition-all ${
              selectedAthleteId === a.inputs.athleteId
                ? "bg-teal-50 border-teal-200 ring-1 ring-teal-200"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${
              a.classification.maturityBand === "Pre-PHV" ? "bg-teal-100 text-teal-700" :
              a.classification.maturityBand === "Mid-PHV" ? "bg-amber-100 text-amber-700" :
              "bg-slate-200 text-slate-700"
            }`}>
              {a.inputs.athleteName.charAt(0)}
            </div>
            <div className="text-left">
              <div className="font-semibold text-sm">{a.inputs.athleteName}</div>
              <div className="text-xs text-slate-500">{a.inputs.teamName}</div>
            </div>
          </button>
        ))}
      </div>

      {selectedLatest && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 print:space-y-8">
          <div className="hidden print:block border-b pb-4 mb-4">
            <h1 className="text-2xl font-bold">{selectedLatest.inputs.athleteName} - {t("analysis.individual.reportTitle")}</h1>
            <p className="text-slate-500">{selectedLatest.inputs.teamName} · {formatDate(new Date().toISOString())}</p>
          </div>

          {/* Maturation Insights Cards */}
          <MaturationInsights result={selectedLatest} />

          {/* Z-Score Card + Comparison */}
          <div className="grid gap-4 md:grid-cols-3">
            {zScoreInfo && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="h-5 w-5 text-teal-600" />
                  <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                    {t("analysis.individual.zScoreLabel")}
                  </h3>
                </div>
                <div 
                  suppressHydrationWarning
                  className={`text-4xl font-bold mb-2 ${
                    zScoreInfo.zScore > 1 ? "text-amber-600" :
                    zScoreInfo.zScore < -1 ? "text-blue-600" : "text-teal-600"
                  }`}
                >
                  {zScoreInfo.zScore.toFixed(2)}
                </div>
                <p className="text-sm text-slate-500 mb-1">
                  {zScoreInfo.interpretation === "early" && t("analysis.individual.zScoreInterpretation.early")}
                  {zScoreInfo.interpretation === "average" && t("analysis.individual.zScoreInterpretation.average")}
                  {zScoreInfo.interpretation === "late" && t("analysis.individual.zScoreInterpretation.late")}
                </p>
                <p className="text-xs text-slate-400">
                  Vs media equipo: {zScoreInfo.teamMean.toFixed(2)}
                </p>
              </div>
            )}

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-5 w-5 text-blue-600" />
                <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                  {t("analysis.individual.vsGroup")}
                </h3>
              </div>
              <div suppressHydrationWarning className="text-4xl font-bold mb-2 text-blue-600">
                {(selectedLatest.classification.primaryOffset - groupMeanOffset).toFixed(2)}
              </div>
              <p className="text-sm text-slate-500 mb-1">
                {t("analysis.individual.diffVsMean")} {selectedLatest.classification.maturityBand}
              </p>
              <p className="text-xs text-slate-400">
                {t("analysis.individual.groupMean")}: {groupMeanOffset.toFixed(2)}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Activity className="h-5 w-5 text-amber-600" />
                <h3 className="font-semibold text-xs uppercase tracking-wider text-slate-500">
                  {t("analysis.individual.avgLoad")}
                </h3>
              </div>
              <div suppressHydrationWarning className="text-4xl font-bold mb-2 text-amber-600">
                {athleteLoad.length > 0 
                  ? Math.round(athleteLoad.slice(-7).reduce((acc, l) => acc + l.load, 0) / Math.min(7, athleteLoad.length))
                  : 0}
              </div>
              <p className="text-sm text-slate-500 mb-1">
                {t("analysis.individual.avgLoadDetail")}
              </p>
              <p className="text-xs text-slate-400">
                {t("analysis.individual.totalRecords")}: {athleteLoad.length}
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Team comparison chart */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 mb-3">
                {t("analysis.individual.teamComparison")}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamComparisonData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.08)" />
                    <XAxis type="number" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="offset" radius={[0, 6, 6, 0]} barSize={18}>
                      {teamComparisonData.map((entry, i) => (
                        <Cell key={i} fill={entry.highlight ? "#0f766e" : "#cbd5e1"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Performance Snapshot */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500 mb-3">
                {t("analysis.individual.performanceTitle")}
              </h3>
              <div className="h-64 overflow-y-auto pr-2">
                {athletePerformance.length > 0 ? (
                  <div className="space-y-3">
                    {[...new Set(athletePerformance.map(p => p.testName))].map(testName => {
                      const latest = athletePerformance.filter(p => p.testName === testName).sort((a,b) => b.measurementDate.localeCompare(a.measurementDate))[0];
                      return (
                        <div key={testName} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                          <div>
                            <div className="text-xs text-slate-500 font-medium uppercase">
                              {latest.area === "physical" && t("datahub.performancePhysical")}
                              {latest.area === "technicalTactical" && t("datahub.performanceTechnicalTactical")}
                              {latest.area === "psychological" && t("datahub.performancePsychological")}
                              {latest.area === "motorSkills" && t("datahub.performanceMotorSkills")}
                            </div>
                            <div className="font-semibold text-sm">{testName}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-teal-600">{latest.value} {latest.unit}</div>
                            <div className="text-[10px] text-slate-400">{formatDate(latest.measurementDate)}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-sm italic">
                    {t("analysis.individual.noPerformance")}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Temporal trend */}
          {selectedHistory.length > 1 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-lg mb-4">{t("analysis.individual.temporalTrend")}</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={selectedHistory.map((item) => ({
                      date: formatDate(item.inputs.dataCollectionDate),
                      stature: item.inputs.statureCm,
                      offset: Number(item.classification.primaryOffset.toFixed(2)),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.08)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="stature" name={t("analysis.individual.statureChart")} stroke="#0f766e" strokeWidth={3} dot={{ r: 4 }} />
                    <Line yAxisId="right" type="monotone" dataKey="offset" name={t("analysis.individual.offsetChart")} stroke="#b45309" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Detailed metrics table */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm print:border-slate-300">
            <div className="p-5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold">{t("analysis.individual.maturityProfile")}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3 font-semibold">{t("analysis.individual.chronologicalAge")}</th>
                    <th className="px-6 py-3 font-semibold">{t("analysis.individual.offsetFromPHV")}</th>
                    <th className="px-6 py-3 font-semibold">{t("analysis.individual.maturityBand")}</th>
                    <th className="px-6 py-3 font-semibold">Moore APHV</th>
                    <th className="px-6 py-3 font-semibold">Mirwald APHV</th>
                    <th className="px-6 py-3 font-semibold">{t("analysis.individual.adultHeightPredictionTitle")}</th>
                    <th className="px-6 py-3 font-semibold">{t("analysis.individual.percentageOfAdult")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-medium">{formatNumber(selectedLatest.derivedMetrics.chronologicalAge, 2)} {t("analysis.collective.years")}</td>
                    <td className="px-6 py-4 font-medium text-teal-600">{formatNumber(selectedLatest.classification.primaryOffset, 2)}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        selectedLatest.classification.maturityBand === "Pre-PHV" ? "bg-teal-100 text-teal-700" :
                        selectedLatest.classification.maturityBand === "Mid-PHV" ? "bg-amber-100 text-amber-700" :
                        "bg-slate-200 text-slate-700"
                      }`}>
                        {selectedLatest.classification.maturityBand}
                      </span>
                    </td>
                    <td className="px-6 py-4">{formatNumber(selectedLatest.methodOutputs.mooreAphv, 2)} {t("analysis.collective.years")}</td>
                    <td className="px-6 py-4">{formatNumber(selectedLatest.methodOutputs.mirwaldAphv, 2)} {t("analysis.collective.years")}</td>
                    <td className="px-6 py-4">{selectedLatest.methodOutputs.pahCm ? `${formatNumber(selectedLatest.methodOutputs.pahCm, 1)} cm` : "N/A"}</td>
                    <td className="px-6 py-4">{selectedLatest.methodOutputs.percentageAdultHeight ? `${formatNumber(selectedLatest.methodOutputs.percentageAdultHeight, 1)}%` : "N/A"}</td>
                  </tr>
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
// COLLECTIVE TAB
// ---------------------------------------------------------------------------
function CollectiveView({
  assessments,
  state,
  t,
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
}) {
  const teams = useMemo(
    () => [...new Set(state.athletes.map((a) => a.teamName).filter(Boolean))] as string[],
    [state.athletes],
  );

  const [selectedTeam, setSelectedTeam] = useState(teams[0] ?? "");

  const latestByAthlete = useMemo(() => {
    const map = new Map<string, (typeof assessments)[number]>();
    for (const a of assessments) {
      const existing = map.get(a.inputs.athleteId);
      if (!existing || existing.inputs.dataCollectionDate < a.inputs.dataCollectionDate) {
        map.set(a.inputs.athleteId, a);
      }
    }
    return Array.from(map.values());
  }, [assessments]);

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

    // Psychological preparation for the team
    const teamAthleteIds = new Set(teamData.map(a => a.inputs.athleteId));
    const psychEntries = state.performanceEntries.filter(e => e.area === "psychological" && teamAthleteIds.has(e.athleteId));
    
    // Average psych scores
    const psychAverages = psychEntries.reduce((acc, e) => {
      if (!acc[e.testName]) acc[e.testName] = { total: 0, count: 0 };
      acc[e.testName].total += e.value;
      acc[e.testName].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    const psychScores = Object.entries(psychAverages).map(([name, data]) => ({
      name,
      value: data.total / data.count
    }));

    return {
      athletes: teamData.map((a) => ({
        ...a,
        zScore: sdOff === 0 ? 0 : (a.classification.primaryOffset - meanOff) / sdOff,
      })),
      meanOffset: meanOff,
      meanAge: teamData.reduce((s, a) => s + a.derivedMetrics.chronologicalAge, 0) / teamData.length,
      meanStature: teamData.reduce((s, a) => s + a.inputs.statureCm, 0) / teamData.length,
      meanWeight: teamData.reduce((s, a) => s + a.inputs.bodyMassKg, 0) / teamData.length,
      bandCounts,
      sdOffset: sdOff,
      earliest: sorted[0],
      latest: sorted[sorted.length - 1],
      maturitySpread: sorted.length > 1 ? sorted[sorted.length - 1].classification.primaryOffset - sorted[0].classification.primaryOffset : 0,
      psychScores,
    };
  }, [latestByAthlete, selectedTeam, state.performanceEntries]);

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
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80}>
                      {distributionData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Stats cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <div className="metric-card rounded-[1.75rem] p-5">
              <p className="text-sm text-ink-soft">{t("analysis.collective.avgOffset")}</p>
              <p suppressHydrationWarning className="mt-2 text-3xl font-semibold">{formatNumber(teamStats.meanOffset, 2)}</p>
            </div>
            <div className="metric-card rounded-[1.75rem] p-5">
              <p className="text-sm text-ink-soft">{t("analysis.collective.avgAge")}</p>
              <p suppressHydrationWarning className="mt-2 text-3xl font-semibold">{formatNumber(teamStats.meanAge, 1)} {t("analysis.collective.years")}</p>
            </div>
            <div className="metric-card rounded-[1.75rem] p-5">
              <p className="text-sm text-ink-soft">{t("analysis.collective.avgStature")}</p>
              <p suppressHydrationWarning className="mt-2 text-3xl font-semibold">{formatNumber(teamStats.meanStature, 1)} cm</p>
            </div>
            <div className="metric-card rounded-[1.75rem] p-5">
              <p className="text-sm text-ink-soft">{t("analysis.collective.avgWeight")}</p>
              <p suppressHydrationWarning className="mt-2 text-3xl font-semibold">{formatNumber(teamStats.meanWeight, 1)} kg</p>
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
              <p className="text-xs text-slate-400">SD: {formatNumber(teamStats.sdOffset, 2)}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel rounded-[1.75rem] p-6">
              <h2 className="mb-4 text-lg font-semibold">{t("analysis.collective.offsetsTitle")}</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={offsetData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(30,41,59,0.08)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
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
              <div className="h-64">
                {teamStats.psychScores.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="80%" data={teamStats.psychScores}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} />
                      <Radar name="Media Equipo" dataKey="value" stroke="#0f766e" fill="#0f766e" fillOpacity={0.5} />
                      <Tooltip />
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
                      <td className="px-6 py-3">{formatNumber(a.derivedMetrics.chronologicalAge, 1)}</td>
                      <td className="px-6 py-3">{a.inputs.statureCm} cm</td>
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
}: {
  assessments: ReturnType<typeof useAppState>["assessments"];
  state: ReturnType<typeof useAppState>["state"];
  t: (k: string) => string;
}) {
  const alerts = useMemo(() => buildAlerts(assessments), [assessments]);
  const rapidGrowth = useMemo(() => detectRapidGrowth(assessments), [assessments]);

  // Combine and deduplicate alerts by athlete for the assistant view
  const athleteStatus = useMemo(() => {
    const map = new Map<string, { 
      name: string; 
      team?: string; 
      band: MaturityBand; 
      alerts: any[]; 
      advice: string[] 
    }>();

    // Latest assessments to get current band
    const latestMap = new Map<string, (typeof assessments)[number]>();
    for (const a of assessments) {
      const existing = latestMap.get(a.inputs.athleteId);
      if (!existing || existing.inputs.dataCollectionDate < a.inputs.dataCollectionDate) {
        latestMap.set(a.inputs.athleteId, a);
      }
    }

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
              severity: "warning",
              category: "rapidGrowth",
              message: t("analysis.assistant.rapidGrowth") + `: +${rg.statureGain}cm`,
              detail: t("analysis.assistant.rapidGrowthDetail").replace("{rate}", rg.monthlyRate.toString())
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
// Main Analysis Page
// ---------------------------------------------------------------------------
export default function AnalysisPage() {
  const { assessments, state } = useAppState();
  const { t } = useLocale();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<AnalysisTab>("individual");

  useEffect(() => {
    const tab = searchParams.get("tab") as AnalysisTab;
    if (tab && (tab === "individual" || tab === "collective" || tab === "assistant")) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const tabLabels: Record<AnalysisTab, string> = {
    individual: t("analysis.tabs.individual"),
    collective: t("analysis.tabs.collective"),
    assistant: t("analysis.tabs.assistant"),
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between no-print">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{t("analysis.title")}</h1>
            <p className="mt-1 text-slate-500">{t("analysis.subtitle")}</p>
          </div>
        </header>

        <TabBar active={activeTab} onChange={setActiveTab} labels={tabLabels} />

        <div className="mt-6">
          {activeTab === "individual" && (
            <IndividualView assessments={assessments} state={state} t={t} />
          )}
          {activeTab === "collective" && (
            <CollectiveView assessments={assessments} state={state} t={t} />
          )}
          {activeTab === "assistant" && (
            <AssistantView assessments={assessments} state={state} t={t} />
          )}
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
