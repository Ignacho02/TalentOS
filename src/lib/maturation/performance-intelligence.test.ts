import assert from "node:assert/strict";
import { demoPerformanceEntries, demoRecords, demoState } from "../demo-data";
import type { AppState, PerformanceEntry, TrainingLoadEntry } from "../types";
import { processAssessmentsWithHistory } from "./history";
import { createUnifiedProfile, getGroupingBand } from "./unified-maturation";
import { buildPerformanceIntelligence } from "./performance-intelligence";

const richerRecords = [
  ...demoRecords,
  {
    ...demoRecords[0],
    id: "rec_leo_new",
    athleteId: "ath_leo",
    athleteName: "Leo Martin",
    dataCollectionDate: "2026-05-20",
    statureCm: 160.4,
    bodyMassKg: 47.4,
    sittingHeightCm: 82.1,
  },
  {
    ...demoRecords[0],
    id: "rec_hugo_new",
    athleteId: "ath_hugo",
    athleteName: "Hugo Sanz",
    dataCollectionDate: "2026-05-21",
    statureCm: 169.4,
    bodyMassKg: 58.8,
    sittingHeightCm: 87.9,
  },
  {
    ...demoRecords[4],
    id: "rec_marta_old",
    athleteId: "ath_marta",
    athleteName: "Marta López",
    dataCollectionDate: "2026-02-10",
    statureCm: 159.8,
    bodyMassKg: 49.2,
    sittingHeightCm: 82.4,
  },
  {
    ...demoRecords[6],
    id: "rec_nora_invalid",
    athleteId: "ath_nora",
    athleteName: "Nora Blanco",
    dataCollectionDate: "2026-05-24",
    statureCm: 260,
    bodyMassKg: 44.5,
    sittingHeightCm: 79.4,
  },
];

const richerPerformanceEntries: PerformanceEntry[] = [
  ...demoPerformanceEntries,
  {
    id: "perf_leo_prev_cmj",
    athleteId: "ath_leo",
    athleteName: "Leo Martin",
    area: "physical",
    teamName: "U14 Boys",
    position: "Winger",
    testName: "CMJ",
    unit: "cm",
    value: 35.6,
    measurementDate: "2026-02-04",
    createdAt: "2026-02-04T09:00:00.000Z",
  },
  {
    id: "perf_hugo_prev_cmj",
    athleteId: "ath_hugo",
    athleteName: "Hugo Sanz",
    area: "physical",
    teamName: "U14 Boys",
    position: "Centre-back",
    testName: "CMJ",
    unit: "cm",
    value: 31.0,
    measurementDate: "2026-02-05",
    createdAt: "2026-02-05T09:00:00.000Z",
  },
  {
    id: "perf_hugo_new_cmj",
    athleteId: "ath_hugo",
    athleteName: "Hugo Sanz",
    area: "physical",
    teamName: "U14 Boys",
    position: "Centre-back",
    testName: "CMJ",
    unit: "cm",
    value: 41.8,
    measurementDate: "2026-05-22",
    createdAt: "2026-05-22T09:00:00.000Z",
  },
];

const richerLoads: TrainingLoadEntry[] = [
  { id: "load-1", athleteId: "ath_leo", date: "2026-04-01", attended: true, sessionType: "training", minutesPlayed: 60, rpe: 5, load: 300 },
  { id: "load-2", athleteId: "ath_leo", date: "2026-04-05", attended: true, sessionType: "training", minutesPlayed: 62, rpe: 5, load: 310 },
  { id: "load-3", athleteId: "ath_leo", date: "2026-04-09", attended: true, sessionType: "training", minutesPlayed: 58, rpe: 5, load: 295 },
  { id: "load-4", athleteId: "ath_leo", date: "2026-04-13", attended: true, sessionType: "match", minutesPlayed: 70, rpe: 5, load: 320 },
  { id: "load-5", athleteId: "ath_leo", date: "2026-05-01", attended: true, sessionType: "training", minutesPlayed: 88, rpe: 8, load: 520 },
  { id: "load-6", athleteId: "ath_leo", date: "2026-05-05", attended: true, sessionType: "training", minutesPlayed: 90, rpe: 8, load: 540 },
  { id: "load-7", athleteId: "ath_leo", date: "2026-05-09", attended: true, sessionType: "training", minutesPlayed: 92, rpe: 8, load: 560 },
  { id: "load-8", athleteId: "ath_leo", date: "2026-05-13", attended: true, sessionType: "match", minutesPlayed: 95, rpe: 8, load: 580 },
];

const testState: AppState = {
  ...demoState,
  records: richerRecords,
  performanceEntries: richerPerformanceEntries,
  trainingLoadEntries: richerLoads,
};

const processed = processAssessmentsWithHistory(testState.records);
const latestAssessments = processed
  .filter((result) => {
    const latestDate = Math.max(
      ...processed
        .filter((candidate) => candidate.inputs.athleteId === result.inputs.athleteId)
        .map((candidate) => new Date(candidate.inputs.dataCollectionDate).getTime()),
    );
    return new Date(result.inputs.dataCollectionDate).getTime() === latestDate;
  })
  .map((assessment) => {
    const profile = createUnifiedProfile(assessment, "auto", "offset", assessment.inputs.sex);
    return {
      ...assessment,
      classification: {
        ...assessment.classification,
        maturityBand: getGroupingBand(profile),
        primaryOffset: profile.offset ?? assessment.classification.primaryOffset,
      },
    };
  });

const intelligence = buildPerformanceIntelligence(latestAssessments, processed, testState, "es");

assert.ok(
  intelligence.insights.some((insight) => insight.severity === "critical"),
  "Should generate critical insights from alert-based risk conditions",
);

assert.ok(
  intelligence.insights.some((insight) => insight.category === "growth" && insight.title.includes("crecimiento acelerado")),
  "Should detect accelerated growth insights",
);

assert.ok(
  intelligence.insights.some((insight) => insight.category === "talent" && insight.athleteId === "ath_hugo"),
  "Should classify emerging talent when performance improves without parallel load increase",
);

assert.ok(
  intelligence.recommendations.length > 0 &&
    intelligence.recommendations.every((item) => item.relatedInsightIds.length > 0),
  "Recommendations should be linked back to their originating insights",
);

const sortedInsights = [...intelligence.insights];
for (let index = 1; index < sortedInsights.length; index += 1) {
  const previous = sortedInsights[index - 1];
  const current = sortedInsights[index];
  const severityRank = { critical: 0, high: 1, medium: 2, low: 3 };
  assert.ok(
    severityRank[previous.severity] < severityRank[current.severity] ||
      (severityRank[previous.severity] === severityRank[current.severity] &&
        previous.createdAt >= current.createdAt),
    "Insights should be ordered by severity and then by recency",
  );
}

console.log("Performance intelligence tests passed!");
