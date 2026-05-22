import type { AnthropometricRecord, MaturationResult } from "@/lib/types";
import { calculateMaturation } from "./calculations";
import { runSitarOptimization } from "./sitar-optimizer";

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
    const baseResults = athleteRecords.map(calculateMaturation);

    // 2. Calculate Growth Velocity (cm/year)
    for (let i = 1; i < baseResults.length; i++) {
      const prev = baseResults[i - 1];
      const curr = baseResults[i];
      
      const prevDate = new Date(prev.inputs.dataCollectionDate).getTime();
      const currDate = new Date(curr.inputs.dataCollectionDate).getTime();
      const diffYears = (currDate - prevDate) / (1000 * 60 * 60 * 24 * 365.25);
      
      if (diffYears > 0) {
        const diffCm = curr.inputs.statureCm - prev.inputs.statureCm;
        curr.derivedMetrics.growthVelocityCmPerYear = diffCm / diffYears;
      }
    }

    // 3. SITAR Model Integration
    // Only run if we have at least 3 records spanning at least 6 months, and athlete is male (per the study)
    if (baseResults.length >= 3 && baseResults[0].inputs.sex === "male") {
      const firstDate = new Date(baseResults[0].inputs.dataCollectionDate).getTime();
      const lastDate = new Date(baseResults[baseResults.length - 1].inputs.dataCollectionDate).getTime();
      const spanYears = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365.25);

      if (spanYears >= 0.5) {
        // Run optimization
        const sitarOutputs = runSitarOptimization(baseResults);
        
        // Inject SITAR results into all records for this athlete (or just the latest ones, but usually it applies to the whole curve)
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
