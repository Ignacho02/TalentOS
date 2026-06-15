import type { AppState, MaturationResult, MaturityBand, PerformanceEntry, TrainingLoadEntry } from "@/lib/types";
import { GROWTH_RATE_THRESHOLDS_CM_PER_YEAR } from "@/lib/maturation/sitar-constants";

// ---------------------------------------------------------------------------
// Shared performance helpers
// ---------------------------------------------------------------------------

export const lowerIsBetterTokens = ["sprint", "agility", "illinois", "slalom", "time"];

/**
 * Returns +1 if a higher value is "better" for this test, -1 if a lower
 * value is "better" (e.g. sprint times). Used to orient comparisons so that
 * "above normal" consistently means "better" and "below normal" means
 * "needs attention" for performance metrics.
 */
export function trendDirection(entry: PerformanceEntry) {
  const token = `${entry.testName} ${entry.unit}`.toLowerCase();
  if (entry.unit.toLowerCase() === "s") return -1;
  return lowerIsBetterTokens.some((candidate) => token.includes(candidate)) ? -1 : 1;
}

// ---------------------------------------------------------------------------
// Alert generation
// ---------------------------------------------------------------------------

export interface AlertItem {
  id: string;
  severity: "critical" | "warning" | "info";
  athleteName: string;
  teamName: string | undefined;
  category: string;
  message: string;
  detail?: string;
}

export function buildAlerts(assessments: MaturationResult[]): AlertItem[] {
  const alerts: AlertItem[] = [];
  let counter = 0;

  for (const a of assessments) {
    const { warnings, inputs, classification, derivedMetrics } = a;

    // Invalid measurements
    if (warnings.includes("unrealistic-stature")) {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "critical",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "invalidMeasurements",
        message: "Unrealistic stature value",
        detail: `${inputs.statureCm} cm is outside normal range (100-250 cm).`,
      });
    }
    if (warnings.includes("unrealistic-weight")) {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "critical",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "invalidMeasurements",
        message: "Unrealistic weight value",
        detail: `${inputs.bodyMassKg} kg is outside normal range (15-200 kg).`,
      });
    }
    if (warnings.includes("invalid-sitting-height")) {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "critical",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "invalidMeasurements",
        message: "Invalid sitting height",
        detail: "Sitting height exceeds total stature.",
      });
    }

    // Missing parent heights
    if (warnings.includes("missing-parent-heights")) {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "warning",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "missingParentHeights",
        message: "Missing parent heights",
        detail: "Khamis-Roche prediction unavailable.",
      });
    }

    // Very late maturation — primaryOffset is engine-resolved by the caller
    if (classification.primaryOffset < -2) {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "warning",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "lateMaturation",
        message: "Very late maturation",
        detail: `Offset: ${classification.primaryOffset.toFixed(2)} years. Monitor closely.`,
      });
    }

    // Very early maturation
    if (classification.primaryOffset > 2) {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "info",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "earlyMaturation",
        message: "Very early maturation",
        detail: `Offset: ${classification.primaryOffset.toFixed(2)} years. Consider competitive grouping.`,
      });
    }

    // Mid-PHV: high injury risk
    if (classification.maturityBand === "Mid-PHV") {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "warning",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "highLoadRisk",
        message: "High load risk during PHV",
        detail: "Athlete is in the growth spurt window. Reduce impact loads.",
      });
    }

    // Age too young
    if (warnings.includes("age-too-young")) {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "warning",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "atRiskAthletes",
        message: "Age too young for reliable prediction",
        detail: `Age: ${derivedMetrics.chronologicalAge.toFixed(2)} years. Results may be unreliable.`,
      });
    }

    // Future collection date
    if (warnings.includes("future-collection-date")) {
      alerts.push({
        id: `alert-${counter++}`,
        severity: "info",
        athleteName: inputs.athleteName,
        teamName: inputs.teamName,
        category: "invalidMeasurements",
        message: "Future collection date",
        detail: `Date: ${inputs.dataCollectionDate}. Check data entry.`,
      });
    }
  }

  // Sort by severity: critical first
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return alerts;
}

// ---------------------------------------------------------------------------
// Rapid growth detection (compare consecutive records for same athlete)
// ---------------------------------------------------------------------------

export interface RapidGrowthAlert {
  id: string;
  athleteId: string;
  athleteName: string;
  teamName: string | undefined;
  dateFrom: string;
  dateTo: string;
  statureGain: number;
  monthsBetween: number;
  /** Growth velocity in cm/year, annualised from the selected interval. */
  yearlyRate: number;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_YEAR = MS_PER_DAY * 365.25;

function isCalendarMonthsApart(dateA: number, dateB: number, months = 6) {
  const earlier = new Date(Math.min(dateA, dateB));
  const later = new Date(Math.max(dateA, dateB));

  const threshold = new Date(earlier);
  threshold.setMonth(threshold.getMonth() + months);

  return later.getTime() >= threshold.getTime();
}

/**
 * Detects rapid growth using the same reference window as the individual
 * analysis growth velocity: for each record, the prior record whose interval
 * is at least 6 months and closest to 1 year is used to annualise the rate
 * (cm/year). This keeps Performance Intelligence alerts consistent with the
 * growth velocity shown in Individual Analysis.
 *
 * Threshold follows Monasterio et al. (2024, Biology of Sport): fast growth
 * is > 7.2 cm/year.
 */
export function detectRapidGrowth(
  assessments: MaturationResult[],
  yearlyThreshold = GROWTH_RATE_THRESHOLDS_CM_PER_YEAR.fast,
): RapidGrowthAlert[] {
  const byAthlete = new Map<string, MaturationResult[]>();
  for (const a of assessments) {
    const list = byAthlete.get(a.inputs.athleteId) ?? [];
    list.push(a);
    byAthlete.set(a.inputs.athleteId, list);
  }

  const alerts: RapidGrowthAlert[] = [];
  let counter = 0;

  for (const [athleteId, records] of byAthlete) {
    const sorted = records.sort(
      (a, b) => a.inputs.dataCollectionDate.localeCompare(b.inputs.dataCollectionDate),
    );

    for (let i = 1; i < sorted.length; i++) {
      const curr = sorted[i];
      const currDate = new Date(curr.inputs.dataCollectionDate).getTime();

      let bestPrevIndex = -1;
      let bestDelta = Infinity;

      for (let j = 0; j < i; j++) {
        const prevDate = new Date(sorted[j].inputs.dataCollectionDate).getTime();
        const gap = currDate - prevDate;

        if (!isCalendarMonthsApart(prevDate, currDate, 6)) continue; // minimum 6 months

        const delta = Math.abs(gap - MS_PER_YEAR);
        if (
          delta < bestDelta ||
          (delta === bestDelta && gap > currDate - new Date(sorted[bestPrevIndex].inputs.dataCollectionDate).getTime())
        ) {
          bestDelta = delta;
          bestPrevIndex = j;
        }
      }

      if (bestPrevIndex === -1) continue; // no candidate ≥6 months apart

      const prev = sorted[bestPrevIndex];
      const prevDate = new Date(prev.inputs.dataCollectionDate).getTime();
      const gain = curr.inputs.statureCm - prev.inputs.statureCm;
      const diffYears = (currDate - prevDate) / MS_PER_YEAR;
      const yearlyRate = gain / diffYears;

      if (yearlyRate > yearlyThreshold) {
        const months = (currDate - prevDate) / (MS_PER_DAY * 30.44);
        alerts.push({
          id: `rapid-${counter++}`,
          athleteId,
          athleteName: curr.inputs.athleteName,
          teamName: curr.inputs.teamName,
          dateFrom: prev.inputs.dataCollectionDate,
          dateTo: curr.inputs.dataCollectionDate,
          statureGain: gain,
          monthsBetween: Math.round(months * 10) / 10,
          yearlyRate: Math.round(yearlyRate * 100) / 100,
        });
      }
    }
  }

  return alerts;
}

// ---------------------------------------------------------------------------
// Group benchmarks: training load & test performance vs team / maturity band
// ---------------------------------------------------------------------------

/** Minimum number of athletes required in a group for a benchmark to be meaningful. */
export const GROUP_BENCHMARK_MIN_SIZE = 4;

/** |z| ranges that define alert magnitude. */
export const DEVIATION_Z_MEDIUM = 1;
export const DEVIATION_Z_HIGH = 2;

export type GroupKind = "team" | "maturityBand";

interface GroupStats {
  mean: number;
  sd: number;
  n: number;
}

export interface GroupBenchmark {
  kind: GroupKind;
  /** Team name, or the MaturityBand label, identifying this group. */
  label: string;
  /** Average training load over the lookback window (absolute units). */
  load: GroupStats | null;
  /** Latest value per test name, oriented so higher = better. */
  tests: Map<string, GroupStats>;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stdDev(values: number[], avg: number): number {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function buildStats(values: number[]): GroupStats | null {
  if (values.length < GROUP_BENCHMARK_MIN_SIZE) return null;
  const avg = mean(values);
  return { mean: avg, sd: stdDev(values, avg), n: values.length };
}

/**
 * Average absolute training load per athlete over the last `windowSize`
 * recorded sessions (default 4, matching the recent-load window used
 * elsewhere for load-ratio alerts).
 */
function athleteAverageLoad(
  athleteId: string,
  trainingLoadEntries: TrainingLoadEntry[],
  windowSize = 4,
): number | null {
  const entries = trainingLoadEntries
    .filter((entry) => entry.athleteId === athleteId)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (entries.length === 0) return null;

  const recent = entries.slice(-windowSize);
  return mean(recent.map((entry) => entry.load));
}

/** Latest recorded value per test for an athlete, oriented so higher = better. */
function athleteLatestTestValues(
  athleteId: string,
  performanceEntries: PerformanceEntry[],
): Map<string, number> {
  const byTest = new Map<string, PerformanceEntry[]>();
  performanceEntries
    .filter((entry) => entry.athleteId === athleteId)
    .forEach((entry) => {
      const list = byTest.get(entry.testName) ?? [];
      list.push(entry);
      byTest.set(entry.testName, list);
    });

  const result = new Map<string, number>();
  byTest.forEach((entries, testName) => {
    const sorted = [...entries].sort((a, b) => a.measurementDate.localeCompare(b.measurementDate));
    const latest = sorted[sorted.length - 1];
    result.set(testName, latest.value * trendDirection(latest));
  });

  return result;
}

/**
 * Builds training-load and test-performance benchmarks (mean & standard
 * deviation) for every team and every maturity band represented in
 * `latestAssessments`. Groups smaller than `GROUP_BENCHMARK_MIN_SIZE`
 * athletes are skipped (their benchmark is `null` / absent).
 */
export function buildGroupBenchmarks(
  latestAssessments: MaturationResult[],
  state: AppState,
): Map<string, GroupBenchmark> {
  const benchmarks = new Map<string, GroupBenchmark>();

  const groupsByKey = new Map<string, { kind: GroupKind; label: string; athleteIds: string[] }>();

  latestAssessments.forEach((assessment) => {
    const athleteId = assessment.inputs.athleteId;
    const teamName = assessment.inputs.teamName;
    const band = assessment.classification.maturityBand;

    if (teamName) {
      const key = `team:${teamName}`;
      const group = groupsByKey.get(key) ?? { kind: "team" as const, label: teamName, athleteIds: [] };
      group.athleteIds.push(athleteId);
      groupsByKey.set(key, group);
    }

    if (band) {
      const key = `maturityBand:${band}`;
      const group = groupsByKey.get(key) ?? { kind: "maturityBand" as const, label: band, athleteIds: [] };
      group.athleteIds.push(athleteId);
      groupsByKey.set(key, group);
    }
  });

  groupsByKey.forEach((group, key) => {
    const loadValues = group.athleteIds
      .map((id) => athleteAverageLoad(id, state.trainingLoadEntries))
      .filter((v): v is number => v !== null);

    const testValuesByName = new Map<string, number[]>();
    group.athleteIds.forEach((id) => {
      athleteLatestTestValues(id, state.performanceEntries).forEach((value, testName) => {
        const list = testValuesByName.get(testName) ?? [];
        list.push(value);
        testValuesByName.set(testName, list);
      });
    });

    const tests = new Map<string, GroupStats>();
    testValuesByName.forEach((values, testName) => {
      const stats = buildStats(values);
      if (stats) tests.set(testName, stats);
    });

    benchmarks.set(key, {
      kind: group.kind,
      label: group.label,
      load: buildStats(loadValues),
      tests,
    });
  });

  return benchmarks;
}

export interface GroupDeviation {
  id: string;
  athleteId: string;
  athleteName: string;
  teamName: string | undefined;
  groupKind: GroupKind;
  groupLabel: string;
  metric: "load" | "test";
  /** Test name when metric === "test". */
  testName?: string;
  /** Athlete's value (absolute load, or test value oriented higher = better). */
  athleteValue: number;
  groupMean: number;
  groupSd: number;
  groupSize: number;
  /** (athleteValue - groupMean) / groupSd */
  zScore: number;
  /** "high" => athlete above group mean, "low" => athlete below group mean. */
  direction: "high" | "low";
  /** "medium" for 1 ≤ |z| < 2, "high" for |z| ≥ 2. */
  magnitude: "medium" | "high";
}

/**
 * Compares each athlete's average training load and latest test results
 * against the team and maturity-band benchmarks, returning one deviation
 * record per metric where |z| ≥ DEVIATION_Z_MEDIUM (1 standard deviation).
 *
 * For each athlete + metric + group kind (team / maturity band), only the
 * single most extreme deviation is returned (callers typically keep at most
 * one alert per athlete/metric/group).
 */
export function detectGroupDeviations(
  latestAssessments: MaturationResult[],
  state: AppState,
  benchmarks: Map<string, GroupBenchmark>,
): GroupDeviation[] {
  const deviations: GroupDeviation[] = [];
  let counter = 0;

  latestAssessments.forEach((assessment) => {
    const athleteId = assessment.inputs.athleteId;
    const athleteName = assessment.inputs.athleteName;
    const teamName = assessment.inputs.teamName;
    const band = assessment.classification.maturityBand;

    const groupKeys: Array<{ kind: GroupKind; key: string; label: string }> = [];
    if (teamName) groupKeys.push({ kind: "team", key: `team:${teamName}`, label: teamName });
    if (band) groupKeys.push({ kind: "maturityBand", key: `maturityBand:${band}`, label: band });

    // --- Training load ---
    const athleteLoad = athleteAverageLoad(athleteId, state.trainingLoadEntries);
    if (athleteLoad !== null) {
      groupKeys.forEach(({ kind, key, label }) => {
        const benchmark = benchmarks.get(key);
        const stats = benchmark?.load;
        if (!stats || stats.sd === 0) return;

        const z = (athleteLoad - stats.mean) / stats.sd;
        if (Math.abs(z) < DEVIATION_Z_MEDIUM) return;

        deviations.push({
          id: `deviation-${counter++}`,
          athleteId,
          athleteName,
          teamName,
          groupKind: kind,
          groupLabel: label,
          metric: "load",
          athleteValue: athleteLoad,
          groupMean: stats.mean,
          groupSd: stats.sd,
          groupSize: stats.n,
          zScore: z,
          direction: z > 0 ? "high" : "low",
          magnitude: Math.abs(z) >= DEVIATION_Z_HIGH ? "high" : "medium",
        });
      });
    }

    // --- Test performance (latest value per test, oriented higher = better) ---
    const latestTestValues = athleteLatestTestValues(athleteId, state.performanceEntries);
    latestTestValues.forEach((value, testName) => {
      groupKeys.forEach(({ kind, key, label }) => {
        const benchmark = benchmarks.get(key);
        const stats = benchmark?.tests.get(testName);
        if (!stats || stats.sd === 0) return;

        const z = (value - stats.mean) / stats.sd;
        if (Math.abs(z) < DEVIATION_Z_MEDIUM) return;

        deviations.push({
          id: `deviation-${counter++}`,
          athleteId,
          athleteName,
          teamName,
          groupKind: kind,
          groupLabel: label,
          metric: "test",
          testName,
          athleteValue: value,
          groupMean: stats.mean,
          groupSd: stats.sd,
          groupSize: stats.n,
          zScore: z,
          direction: z > 0 ? "high" : "low",
          magnitude: Math.abs(z) >= DEVIATION_Z_HIGH ? "high" : "medium",
        });
      });
    });
  });

  return deviations;
}