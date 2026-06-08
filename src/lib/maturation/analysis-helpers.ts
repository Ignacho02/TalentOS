import type { MaturationResult, MaturityBand } from "@/lib/types";

// ---------------------------------------------------------------------------
// Basic statistics helpers
// ---------------------------------------------------------------------------

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function zScore(value: number, values: number[]): number {
  const sd = stdDev(values);
  if (sd === 0) return 0;
  return (value - mean(values)) / sd;
}

// ---------------------------------------------------------------------------
// Team-level aggregation
// ---------------------------------------------------------------------------

export interface TeamStats {
  athleteId: string;
  athleteName: string;
  teamName: string | undefined;
  offset: number;
  band: MaturityBand | null;
  statureCm: number;
  bodyMassKg: number;
  chronologicalAge: number;
  maturityZScore: number;
}

export interface TeamSummary {
  teamName: string;
  athletes: TeamStats[];
  meanOffset: number;
  meanAge: number;
  meanStature: number;
  meanWeight: number;
  bandCounts: Record<MaturityBand, number>;
  sdOffset: number;
  earliest: { name: string; offset: number };
  latest: { name: string; offset: number };
}

export function buildTeamStats(
  assessments: MaturationResult[],
  teamName: string | undefined,
): TeamSummary | null {
  const filtered = assessments.filter(
    (a) => a.inputs.teamName === teamName || teamName === undefined,
  );
  if (filtered.length === 0) return null;

  const athletes: TeamStats[] = filtered.map((a) => ({
    athleteId: a.inputs.athleteId,
    athleteName: a.inputs.athleteName,
    teamName: a.inputs.teamName,
    offset: a.classification.primaryOffset,
    band: a.classification.maturityBand,
    statureCm: a.inputs.statureCm,
    bodyMassKg: a.inputs.bodyMassKg,
    chronologicalAge: a.derivedMetrics.chronologicalAge,
    maturityZScore: 0, // computed below
  }));

  const offsets = athletes.map((a) => a.offset);
  const m = mean(offsets);
  const sd = stdDev(offsets);

  athletes.forEach((a) => {
    a.maturityZScore = sd === 0 ? 0 : (a.offset - m) / sd;
  });

  const bandCounts: Record<MaturityBand, number> = {
    "Pre-PHV": 0,
    "Mid-PHV": 0,
    "Post-PHV": 0,
  };
  athletes.forEach((a) => {
    if (a.band) bandCounts[a.band]++;
  });

  const sorted = [...athletes].sort((a, b) => a.offset - b.offset);

  return {
    teamName: teamName ?? "All",
    athletes,
    meanOffset: m,
    meanAge: mean(athletes.map((a) => a.chronologicalAge)),
    meanStature: mean(athletes.map((a) => a.statureCm)),
    meanWeight: mean(athletes.map((a) => a.bodyMassKg)),
    bandCounts,
    sdOffset: sd,
    earliest: { name: sorted[0].athleteName, offset: sorted[0].offset },
    latest: { name: sorted[sorted.length - 1].athleteName, offset: sorted[sorted.length - 1].offset },
  };
}

// ---------------------------------------------------------------------------
// Z-score for a single athlete within their team
// ---------------------------------------------------------------------------

export interface AthleteZScore {
  athleteId: string;
  athleteName: string;
  offset: number;
  zScore: number;
  interpretation: "early" | "average" | "late";
  teamMean: number;
  teamSD: number;
  teammateCount: number;
}

export function computeAthleteZScore(
  assessment: MaturationResult,
  teamAssessments: MaturationResult[],
): AthleteZScore {
  const offsets = teamAssessments.map((a) => a.classification.primaryOffset);
  const sd = stdDev(offsets);
  const m = mean(offsets);
  const z = sd === 0 ? 0 : (assessment.classification.primaryOffset - m) / sd;

  let interpretation: "early" | "average" | "late";
  if (z > 1) interpretation = "early";
  else if (z < -1) interpretation = "late";
  else interpretation = "average";

  return {
    athleteId: assessment.inputs.athleteId,
    athleteName: assessment.inputs.athleteName,
    offset: assessment.classification.primaryOffset,
    zScore: z,
    interpretation,
    teamMean: m,
    teamSD: sd,
    teammateCount: teamAssessments.length,
  };
}

// ---------------------------------------------------------------------------
// Bio-banding: group athletes by maturity band
// ---------------------------------------------------------------------------

export interface BioBandingGroup {
  band: MaturityBand;
  label: string;
  advice: string;
  athletes: {
    id: string;
    name: string;
    teamName: string | undefined;
    ageGroup: string;
    offset: number;
    zScore: number;
    statureCm: number;
    bodyMassKg: number;
  }[];
}

export function buildBioBandingGroups(
  assessments: MaturationResult[],
): BioBandingGroup[] {
  // Deduplicate: keep only latest assessment per athlete
  const latestMap = new Map<string, MaturationResult>();
  for (const a of assessments) {
    const existing = latestMap.get(a.inputs.athleteId);
    if (!existing || existing.inputs.dataCollectionDate < a.inputs.dataCollectionDate) {
      latestMap.set(a.inputs.athleteId, a);
    }
  }
  const latestAssessments = Array.from(latestMap.values());

  const bands: { band: MaturityBand; label: string; advice: string }[] = [
    { band: "Post-PHV", label: "Early maturers", advice: "Strength loads and competition ready." },
    { band: "Mid-PHV", label: "Average maturers", advice: "Monitor loads, adapt volume." },
    { band: "Pre-PHV", label: "Late maturers", advice: "Prioritize coordination and technique." },
  ];

  // Calculate global Z-scores
  const offsets = latestAssessments.map((a) => a.classification.primaryOffset);
  const sd = stdDev(offsets);
  const m = mean(offsets);

  return bands.map(({ band, label, advice }) => {
    const grouped = latestAssessments
      .filter((a) => a.classification.maturityBand === band)
      .map((a) => ({
        id: a.inputs.athleteId,
        name: a.inputs.athleteName,
        teamName: a.inputs.teamName,
        ageGroup: a.inputs.ageGroup,
        offset: a.classification.primaryOffset,
        zScore: sd === 0 ? 0 : (a.classification.primaryOffset - m) / sd,
        statureCm: a.inputs.statureCm,
        bodyMassKg: a.inputs.bodyMassKg,
      }))
      .sort((a, b) => a.offset - b.offset);

    return { band, label, advice, athletes: grouped };
  });
}

// ---------------------------------------------------------------------------
// Alerts / warnings aggregation
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
    const { warnings, inputs, classification, methodOutputs, derivedMetrics } = a;

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

    // Very late maturation (offset < -2)
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

    // Very early maturation (offset > 2)
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
