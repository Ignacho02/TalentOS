"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { demoState } from "@/lib/demo-data";
import { calculateMaturation } from "@/lib/maturation/calculations";
import type {
  AppState,
  AnthropometricRecord,
  AnthropometricRecordInput,
  Athlete,
  Club,
  Locale,
  MaturationResult,
  PerformanceDefinition,
  PerformanceEntry,
  PerformanceEntryInput,
  Team,
  TrainingLoadEntry,
} from "@/lib/types";
import { STORAGE_KEY } from "@/lib/config";
import { uid } from "@/lib/utils";

interface AppStateContextValue {
  state: AppState;
  assessments: MaturationResult[];
  addRecord: (input: AnthropometricRecordInput) => boolean;
  importRecords: (rows: AnthropometricRecordInput[]) => number;
  updateRecord: (id: string, updates: Partial<AnthropometricRecordInput>) => void;
  addPerformanceEntry: (input: PerformanceEntryInput) => void;
  importPerformanceEntries: (rows: PerformanceEntryInput[]) => number;
  setLocale: (locale: Locale) => void;
  addTeam: (team: Omit<Team, "id">) => void;
  updateTeam: (id: string, updates: Partial<Team>) => void;
  deleteTeam: (id: string) => void;
  addAthlete: (athlete: Omit<Athlete, "id">) => void;
  updateAthlete: (id: string, updates: Partial<Athlete>) => void;
  deleteAthlete: (id: string) => void;
  updateClub: (updates: Partial<Club>) => void;
  addTrainingLoadEntry: (entry: Omit<TrainingLoadEntry, "id" | "load">) => void;
  deleteTrainingLoadEntry: (id: string) => void;
  addPerformanceDefinition: (def: Omit<PerformanceDefinition, "id">) => void;
  updatePerformanceDefinition: (id: string, updates: Partial<PerformanceDefinition>) => void;
  deletePerformanceDefinition: (id: string) => void;
  resetState: () => void;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

function normalizeState(input: any): AppState {
  const candidate = input ?? {};

  // Migrate performanceDefinitions
  const rawDefs = Array.isArray(candidate.performanceDefinitions)
    ? (candidate.performanceDefinitions as any[])
    : undefined;

  const migratedDefs: PerformanceDefinition[] | undefined = rawDefs?.map((d: any) => {
    // If it's already in the new format, keep it but ensure fields exist
    if (d.scoringStrategy && d.interpretation) {
      return {
        ...d,
        scoringStrategy: d.scoringStrategy || "best",
        interpretation: d.interpretation || "higher_better",
      } as PerformanceDefinition;
    }
    // Migrate legacy `calculation` field
    const calc: string | undefined = d.calculation;
    let scoringStrategy: "best" | "average" = "best";
    let interpretation: "higher_better" | "lower_better" = "higher_better";
    if (calc === "average") {
      scoringStrategy = "average";
    } else if (calc === "best_min") {
      interpretation = "lower_better";
    }
    const { calculation: _removed, ...rest } = d;
    return {
      ...rest,
      scoringStrategy,
      interpretation,
      // Ensure other fields exist
      attempts: rest.attempts || 1,
      isRating: !!rest.isRating,
      area: rest.area || "physical",
    } as PerformanceDefinition;
  });

  const baseState: AppState = {
    club: candidate.club ?? demoState.club,
    teams: Array.isArray(candidate.teams) ? candidate.teams : demoState.teams,
    athletes: Array.isArray(candidate.athletes) ? candidate.athletes : demoState.athletes,
    records: Array.isArray(candidate.records) ? candidate.records : demoState.records,
    performanceEntries: Array.isArray(candidate.performanceEntries) ? candidate.performanceEntries : demoState.performanceEntries,
    trainingLoadEntries: Array.isArray(candidate.trainingLoadEntries) ? candidate.trainingLoadEntries : demoState.trainingLoadEntries,
    performanceDefinitions: (migratedDefs ?? demoState.performanceDefinitions).map(def => {
      const demoRef = demoState.performanceDefinitions.find(ref => ref.id === def.id);
      if (demoRef) {
        return {
          ...def,
          nameKey: def.nameKey || demoRef.nameKey,
          descriptionKey: def.descriptionKey || demoRef.descriptionKey,
        };
      }
      return def;
    }),
    preferences: {
      ...demoState.preferences,
      ...(candidate.preferences ?? {}),
    },
  };

  const existingTeamIds = new Set(baseState.teams.map((team) => team.id));
  const existingAthleteIds = new Set(baseState.athletes.map((athlete) => athlete.id));
  const existingRecordIds = new Set(baseState.records.map((record) => record.id));
  const existingPerformanceIds = new Set(baseState.performanceEntries.map((entry) => entry.id));
  const existingDefIds = new Set(baseState.performanceDefinitions.map((d) => d.id));

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
      ...demoState.performanceDefinitions.filter((d) => !existingDefIds.has(d.id)),
    ],
  };
}

function buildAthleteFromInput(
  state: AppState,
  input: AnthropometricRecordInput,
): { athlete: Athlete; team?: Team } {
  const existingAthlete = state.athletes.find(
    (athlete) =>
      athlete.name.toLowerCase() === input.athleteName.toLowerCase() &&
      athlete.dob === input.dob,
  );

  if (existingAthlete) return { athlete: existingAthlete };

  let team = state.teams.find(
    (candidate) =>
      candidate.name === input.teamName || candidate.ageGroup === input.ageGroup,
  );

  if (!team) {
    team = {
      id: uid("team"),
      clubId: state.club.id,
      name: input.teamName ?? input.ageGroup,
      ageGroup: input.ageGroup,
    };
  }

  return {
    team,
    athlete: {
      id: uid("ath"),
      clubId: state.club.id,
      teamId: team.id,
      name: input.athleteName,
      sex: input.sex,
      ageGroup: input.ageGroup,
      clubName: input.clubName,
      teamName: input.teamName,
      position: input.position,
      dob: input.dob,
    },
  };
}

function buildRecord(
  athleteId: string,
  input: AnthropometricRecordInput,
): AnthropometricRecord {
  return {
    id: uid("rec"),
    athleteId,
    createdAt: new Date().toISOString(),
    ...input,
  };
}

function buildPerformanceEntry(
  athleteId: string,
  input: PerformanceEntryInput,
): PerformanceEntry {
  return {
    id: uid("perf"),
    athleteId,
    createdAt: new Date().toISOString(),
    ...input,
  };
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    try {
      const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<AppState>;
        return normalizeState(parsed);
      }
    } catch {
      // Keep demo state if persisted data is malformed.
    }
    return demoState;
  });

  useEffect(() => {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const assessments = useMemo(
    () => state.records.map(calculateMaturation),
    [state.records],
  );

  const addRecord = (input: AnthropometricRecordInput) => {
    let added = false;

    startTransition(() => {
      setState((current) => {
        const duplicate = current.records.some(
          (record) =>
            record.athleteName.toLowerCase() === input.athleteName.toLowerCase() &&
            record.dataCollectionDate === input.dataCollectionDate,
        );
        if (duplicate) return current;

        const { athlete, team } = buildAthleteFromInput(current, input);
        added = true;

        // Inherit parent heights from most recent previous record if not provided
        let enrichedInput = input;
        if (input.motherHeightCm == null || input.fatherHeightCm == null) {
          const prevRecords = current.records
            .filter((r) => r.athleteName.toLowerCase() === input.athleteName.toLowerCase())
            .sort((a, b) => b.dataCollectionDate.localeCompare(a.dataCollectionDate));
          const prevWithParents = prevRecords.find(
            (r) => r.motherHeightCm != null || r.fatherHeightCm != null
          );
          if (prevWithParents) {
            enrichedInput = {
              ...input,
              motherHeightCm: input.motherHeightCm ?? prevWithParents.motherHeightCm,
              fatherHeightCm: input.fatherHeightCm ?? prevWithParents.fatherHeightCm,
            };
          }
        }

        return {
          ...current,
          teams:
            team && !current.teams.some((existing) => existing.id === team.id)
              ? [...current.teams, team]
              : current.teams,
          athletes: current.athletes.some((existing) => existing.id === athlete.id)
            ? current.athletes.map((existing) =>
                existing.id === athlete.id
                  ? {
                      ...existing,
                      position: input.position || existing.position,
                      teamName: input.teamName || existing.teamName,
                    }
                  : existing,
              )
            : [...current.athletes, athlete],
          records: [...current.records, buildRecord(athlete.id, enrichedInput)],
        };
      });
    });

    return added;
  };

  const updateRecord = (id: string, updates: Partial<AnthropometricRecordInput>) => {
    setState((current) => ({
      ...current,
      records: current.records.map((r) =>
        r.id === id ? { ...r, ...updates } : r
      ),
    }));
  };

  const importRecords = (rows: AnthropometricRecordInput[]) => {
    let imported = 0;

    setState((current) => {
      const newTeams = new Map(current.teams.map((t) => [t.id, t]));
      const athleteMap = new Map(current.athletes.map((a) => [a.id, { ...a }]));
      const newRecords: typeof current.records = [];

      for (const row of rows) {
        const duplicate = current.records.some(
          (record) =>
            record.athleteName.toLowerCase() === row.athleteName.toLowerCase() &&
            record.dataCollectionDate === row.dataCollectionDate,
        );
        if (duplicate) continue;

        const { athlete, team } = buildAthleteFromInput(
          { ...current, teams: Array.from(newTeams.values()), athletes: Array.from(athleteMap.values()) },
          row,
        );
        imported += 1;

        if (team && !newTeams.has(team.id)) {
          newTeams.set(team.id, team);
        }

        const existing = athleteMap.get(athlete.id);
        if (existing) {
          athleteMap.set(athlete.id, {
            ...existing,
            position: row.position || existing.position,
            teamName: row.teamName || existing.teamName,
          });
        } else {
          athleteMap.set(athlete.id, athlete);
        }

        // Inherit parent heights from most recent previous record if not provided
        let enrichedRow = row;
        if (row.motherHeightCm == null || row.fatherHeightCm == null) {
          const prevRecs = [...current.records, ...newRecords]
            .filter((r) => r.athleteName.toLowerCase() === row.athleteName.toLowerCase())
            .sort((a, b) => b.dataCollectionDate.localeCompare(a.dataCollectionDate));
          const prevWithParents = prevRecs.find((r) => r.motherHeightCm != null || r.fatherHeightCm != null);
          if (prevWithParents) {
            enrichedRow = {
              ...row,
              motherHeightCm: row.motherHeightCm ?? prevWithParents.motherHeightCm,
              fatherHeightCm: row.fatherHeightCm ?? prevWithParents.fatherHeightCm,
            };
          }
        }
        newRecords.push(buildRecord(athlete.id, enrichedRow));
      }

      return {
        ...current,
        teams: Array.from(newTeams.values()),
        athletes: Array.from(athleteMap.values()),
        records: [...current.records, ...newRecords],
      };
    });

    return imported;
  };

  const addPerformanceEntry = (input: PerformanceEntryInput) => {
    setState((current) => {
      const athlete =
        current.athletes.find((item) => item.id === input.athleteId) ??
        current.athletes.find(
          (item) => item.name.toLowerCase() === input.athleteName.toLowerCase(),
        );

      if (!athlete) {
        return current;
      }

      return {
        ...current,
        performanceEntries: [
          ...current.performanceEntries,
          buildPerformanceEntry(athlete.id, {
            ...input,
            athleteId: athlete.id,
            teamName: input.teamName ?? athlete.teamName,
            position: input.position ?? athlete.position,
          }),
        ],
      };
    });
  };

  const importPerformanceEntries = (rows: PerformanceEntryInput[]) => {
    let imported = 0;

    setState((current) => {
      const entries: PerformanceEntry[] = [];

      for (const row of rows) {
        const athlete =
          current.athletes.find((item) => item.id === row.athleteId) ??
          current.athletes.find(
            (item) => item.name.toLowerCase() === row.athleteName.toLowerCase(),
          );

        if (!athlete) {
          continue;
        }

        entries.push(
          buildPerformanceEntry(athlete.id, {
            ...row,
            athleteId: athlete.id,
            teamName: row.teamName ?? athlete.teamName,
            position: row.position ?? athlete.position,
          }),
        );
        imported += 1;
      }

      if (!entries.length) {
        return current;
      }

      return {
        ...current,
        performanceEntries: [...current.performanceEntries, ...entries],
      };
    });

    return imported;
  };

  const setLocale = (locale: Locale) => {
    setState((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        locale,
      },
    }));

    void fetch("/api/users/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
  };

  // Team management
  const addTeam = (team: Omit<Team, "id">) => {
    setState((current) => ({
      ...current,
      teams: [...current.teams, { ...team, id: uid("team") }],
    }));
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    setState((current) => ({
      ...current,
      teams: current.teams.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  };

  const deleteTeam = (id: string) => {
    setState((current) => ({
      ...current,
      teams: current.teams.filter((t) => t.id !== id),
      athletes: current.athletes.map((a) =>
        a.teamId === id ? { ...a, teamId: undefined, teamName: undefined } : a,
      ),
    }));
  };

  // Athlete management
  const addAthlete = (athlete: Omit<Athlete, "id">) => {
    setState((current) => ({
      ...current,
      athletes: [...current.athletes, { ...athlete, id: uid("ath") }],
    }));
  };

  const updateAthlete = (id: string, updates: Partial<Athlete>) => {
    setState((current) => ({
      ...current,
      athletes: current.athletes.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  };

  const deleteAthlete = (id: string) => {
    setState((current) => ({
      ...current,
      athletes: current.athletes.filter((a) => a.id !== id),
      records: current.records.filter((r) => r.athleteId !== id),
      performanceEntries: current.performanceEntries.filter((e) => e.athleteId !== id),
      trainingLoadEntries: current.trainingLoadEntries.filter((e) => e.athleteId !== id),
    }));
  };

  // Club settings
  const updateClub = (updates: Partial<Club>) => {
    setState((current) => ({
      ...current,
      club: { ...current.club, ...updates },
    }));
  };

  // Training load
  const addTrainingLoadEntry = (entry: Omit<TrainingLoadEntry, "id" | "load">) => {
    const load = entry.attended ? entry.minutesPlayed * entry.rpe : 0;
    setState((current) => ({
      ...current,
      trainingLoadEntries: [
        ...current.trainingLoadEntries,
        { ...entry, id: uid("tl"), load },
      ],
    }));
  };

  const deleteTrainingLoadEntry = (id: string) => {
    setState((current) => ({
      ...current,
      trainingLoadEntries: current.trainingLoadEntries.filter((e) => e.id !== id),
    }));
  };

  // Performance definitions
  const addPerformanceDefinition = (def: Omit<PerformanceDefinition, "id">) => {
    setState((current) => ({
      ...current,
      performanceDefinitions: [...current.performanceDefinitions, { ...def, id: uid("pdef") }],
    }));
  };

  const updatePerformanceDefinition = (id: string, updates: Partial<PerformanceDefinition>) => {
    setState((current) => ({
      ...current,
      performanceDefinitions: current.performanceDefinitions.map((d) =>
        d.id === id ? { ...d, ...updates } : d,
      ),
    }));
  };

  const deletePerformanceDefinition = (id: string) => {
    setState((current) => ({
      ...current,
      performanceDefinitions: current.performanceDefinitions.filter((d) => d.id !== id),
    }));
  };

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      assessments,
      addRecord,
      updateRecord,
      importRecords,
      addPerformanceEntry,
      importPerformanceEntries,
      setLocale,
      addTeam,
      updateTeam,
      deleteTeam,
      addAthlete,
      updateAthlete,
      deleteAthlete,
      updateClub,
      addTrainingLoadEntry,
      deleteTrainingLoadEntry,
      addPerformanceDefinition,
      updatePerformanceDefinition,
      deletePerformanceDefinition,
      resetState: () => {
        if (confirm(globalThis.localStorage?.getItem("locale") === "es" ? "¿Estás seguro de que quieres borrar todos los datos y restablecer la demo?" : "Are you sure you want to clear all data and reset the demo?")) {
          setState(demoState);
        }
      },
    }),
    [state, assessments],
  );

  return (
    <AppStateContext.Provider value={value}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used within AppStateProvider");
  return context;
}