import { demoState } from "@/lib/demo-data";
import type { AppState, PerformanceDefinition } from "@/lib/types";

type LegacyPerformanceDefinition = Partial<PerformanceDefinition> & {
  calculation?: string;
};

type PersistedAppState = Partial<AppState> & {
  performanceDefinitions?: LegacyPerformanceDefinition[];
};

function asPersistedState(input: unknown): PersistedAppState {
  if (typeof input === "object" && input !== null) {
    return input as PersistedAppState;
  }

  return {};
}

function migratePerformanceDefinitions(
  definitions: LegacyPerformanceDefinition[] | undefined,
) {
  return definitions?.map((definition) => {
    if (definition.scoringStrategy && definition.interpretation) {
      return {
        ...definition,
        scoringStrategy: definition.scoringStrategy || "best",
        interpretation: definition.interpretation || "higher_better",
      } as PerformanceDefinition;
    }

    let scoringStrategy: "best" | "average" = "best";
    let interpretation: "higher_better" | "lower_better" = "higher_better";

    if (definition.calculation === "average") {
      scoringStrategy = "average";
    } else if (definition.calculation === "best_min") {
      interpretation = "lower_better";
    }

    const { calculation: _removed, ...rest } = definition;

    return {
      ...rest,
      scoringStrategy,
      interpretation,
      attempts: rest.attempts || 1,
      isRating: !!rest.isRating,
      area: rest.area || "physical",
    } as PerformanceDefinition;
  });
}

export function normalizeState(input: unknown): AppState {
  const candidate = asPersistedState(input);
  const migratedDefinitions = migratePerformanceDefinitions(candidate.performanceDefinitions);

  const baseState: AppState = {
    club: candidate.club ?? demoState.club,
    teams: Array.isArray(candidate.teams) ? candidate.teams : demoState.teams,
    athletes: Array.isArray(candidate.athletes) ? candidate.athletes : demoState.athletes,
    records: Array.isArray(candidate.records) ? candidate.records : demoState.records,
    performanceEntries: Array.isArray(candidate.performanceEntries)
      ? candidate.performanceEntries
      : demoState.performanceEntries,
    trainingLoadEntries: Array.isArray(candidate.trainingLoadEntries)
      ? candidate.trainingLoadEntries
      : demoState.trainingLoadEntries,
    performanceDefinitions: (migratedDefinitions ?? demoState.performanceDefinitions).map(
      (definition) => {
        const demoReference = demoState.performanceDefinitions.find(
          (reference) => reference.id === definition.id,
        );

        if (!demoReference) {
          return definition;
        }

        return {
          ...definition,
          nameKey: definition.nameKey || demoReference.nameKey,
          descriptionKey: definition.descriptionKey || demoReference.descriptionKey,
        };
      },
    ),
    preferences: {
      ...demoState.preferences,
      ...(candidate.preferences ?? {}),
    },
  };

  const existingTeamIds = new Set(baseState.teams.map((team) => team.id));
  const existingAthleteIds = new Set(baseState.athletes.map((athlete) => athlete.id));
  const existingRecordIds = new Set(baseState.records.map((record) => record.id));
  const existingPerformanceIds = new Set(
    baseState.performanceEntries.map((entry) => entry.id),
  );
  const existingDefinitionIds = new Set(
    baseState.performanceDefinitions.map((definition) => definition.id),
  );

  return {
    ...baseState,
    teams: [
      ...baseState.teams,
      ...demoState.teams.filter((team) => !existingTeamIds.has(team.id)),
    ],
    athletes: [
      ...baseState.athletes,
      ...demoState.athletes.filter((athlete) => !existingAthleteIds.has(athlete.id)),
    ],
    records: [
      ...baseState.records,
      ...demoState.records.filter((record) => !existingRecordIds.has(record.id)),
    ],
    performanceEntries: [
      ...baseState.performanceEntries,
      ...demoState.performanceEntries.filter(
        (entry) => !existingPerformanceIds.has(entry.id),
      ),
    ],
    performanceDefinitions: [
      ...baseState.performanceDefinitions,
      ...demoState.performanceDefinitions.filter(
        (definition) => !existingDefinitionIds.has(definition.id),
      ),
    ],
  };
}
