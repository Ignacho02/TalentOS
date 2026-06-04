import type { AnthropometricRecord, MaturationResult } from "@/lib/types";
import { calculateMaturation } from "./calculations";
import { runSitarOptimization } from "./sitar-optimizer";

function monthsBetween(dateA: number, dateB: number) {
  return Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24 * 30.4375);
}

function isCalendarMonthsApart(dateA: number, dateB: number, months = 6) {
  const earlier = new Date(Math.min(dateA, dateB));
  const later = new Date(Math.max(dateA, dateB));

  const threshold = new Date(earlier);
  threshold.setMonth(threshold.getMonth() + months);

  return later.getTime() >= threshold.getTime();
}

function hasIrregularLongitudinalPattern(history: MaturationResult[]) {
  if (history.length < 3) return false;

  const dates = history
    .map((record) => new Date(record.inputs.dataCollectionDate).getTime())
    .sort((a, b) => a - b);

  const intervals = [];
  for (let i = 1; i < dates.length; i++) {
    intervals.push(monthsBetween(dates[i - 1], dates[i]));
  }

  if (intervals.length < 2) return false;

  const average = intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  const sorted = [...intervals].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const maxInterval = Math.max(...intervals);

  const hasLargeGap = maxInterval >= Math.max(6, median * 1.75);
  const hasVariableSpacing = intervals.some((interval) => Math.abs(interval - average) > Math.max(2, average * 0.55));

  return hasLargeGap || hasVariableSpacing;
}

export function processAssessmentsWithHistory(records: AnthropometricRecord[]): MaturationResult[] {
  // 1. Group records by athlete
  const byAthlete = new Map<string, AnthropometricRecord[]>();
  for (const record of records) {
    if (!byAthlete.has(record.athleteId)) {
      byAthlete.set(record.athleteId, []);
    }
    byAthlete.get(record.athleteId)!.push(record);
  }

  const results: MaturationResult[] = [];

  for (const [athleteId, athleteRecords] of Array.from(byAthlete.entries())) {
    // Sort records chronologically
    athleteRecords.sort((a, b) => a.dataCollectionDate.localeCompare(b.dataCollectionDate));

    // Basic calculation for each record
    const baseResults = athleteRecords.map(r => calculateMaturation(r, r.parentalHeightsReported ?? true));

    // 2. Calculate Growth Velocity (cm/year)
    // Only estimate velocity when the pair spans at least 6 months.
    for (let i = 1; i < baseResults.length; i++) {
      const prev = baseResults[i - 1];
      const curr = baseResults[i];
      
      const prevDate = new Date(prev.inputs.dataCollectionDate).getTime();
      const currDate = new Date(curr.inputs.dataCollectionDate).getTime();
      const diffYears = (currDate - prevDate) / (1000 * 60 * 60 * 24 * 365.25);

      if (isCalendarMonthsApart(prevDate, currDate, 6)) {
        const diffCm = curr.inputs.statureCm - prev.inputs.statureCm;
        curr.derivedMetrics.growthVelocityCmPerYear = diffCm / diffYears;
      }
    }

    // 3. SITAR Model Integration
    // Only run if we have at least 3 longitudinal records spanning at least 6 months,
    // athlete is male, and the date pattern is irregular or contains larger-than-expected gaps.
    if (baseResults.length >= 3 && baseResults[0].inputs.sex === "male") {
      const firstDate = new Date(baseResults[0].inputs.dataCollectionDate).getTime();
      const lastDate = new Date(baseResults[baseResults.length - 1].inputs.dataCollectionDate).getTime();
      const spanYears = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365.25);

      if (spanYears >= 0.5 && hasIrregularLongitudinalPattern(baseResults)) {
        const sitarOutputs = runSitarOptimization(baseResults);

        if (sitarOutputs) {
          for (const res of baseResults) {
            res.sitarOutputs = sitarOutputs;
          }
        }
      }
    }

    results.push(...baseResults);
  }

  // Preserve original order if possible, though grouping messes it up. 
  // For the dashboard, order usually doesn't matter as it relies on IDs/Dates.
  return results;
}