import type { MaturationResult } from "@/lib/types";

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
  monthlyRate: number;
}

export function detectRapidGrowth(
  assessments: MaturationResult[],
  monthlyThreshold = 0.8,
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
      const prev = sorted[i - 1];
      const curr = sorted[i];
      const gain = curr.inputs.statureCm - prev.inputs.statureCm;

      const d1 = new Date(prev.inputs.dataCollectionDate);
      const d2 = new Date(curr.inputs.dataCollectionDate);
      const months = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24 * 30.44);

      if (months > 0 && gain / months > monthlyThreshold) {
        alerts.push({
          id: `rapid-${counter++}`,
          athleteId,
          athleteName: curr.inputs.athleteName,
          teamName: curr.inputs.teamName,
          dateFrom: prev.inputs.dataCollectionDate,
          dateTo: curr.inputs.dataCollectionDate,
          statureGain: gain,
          monthsBetween: Math.round(months * 10) / 10,
          monthlyRate: Math.round((gain / months) * 100) / 100,
        });
      }
    }
  }

  return alerts;
}