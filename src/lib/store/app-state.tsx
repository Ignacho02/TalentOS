"use client";

import {
  createContext,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { calculateMaturation } from "@/lib/maturation/calculations";
import {
  addAthleteAction,
  deleteAthleteAction,
  updateAthleteAction,
} from "@/lib/actions/athletes";
import {
  addRecordAction,
  updateRecordAction,
} from "@/lib/actions/records";
import { addTeamAction, deleteTeamAction, updateTeamAction } from "@/lib/actions/teams";
import type {
  AppState,
  AnthropometricRecordInput,
  Athlete,
  Club,
  Locale,
  MaturationResult,
  PerformanceDefinition,
  PerformanceEntryInput,
  Team,
  TrainingLoadEntry,
} from "@/lib/types";
import { normalizeState } from "./app-state-normalization";
import {
  addAthleteToState,
  addPerformanceDefinitionToState,
  addPerformanceEntryToState,
  addRecordToState,
  addTeamToState,
  addTrainingLoadEntryToState,
  deleteAthleteFromState,
  deletePerformanceDefinitionFromState,
  deletePerformanceEntryInState,
  deleteTeamFromState,
  deleteTrainingLoadEntryFromState,
  importPerformanceEntriesToState,
  importRecordsToState,
  resetAppState,
  setLocaleInState,
  updateAthleteInState,
  updateClubInState,
  updatePerformanceDefinitionInState,
  updatePerformanceEntryInState,
  updateRecordInState,
  updateTeamInState,
} from "./app-state-updaters";
import {
  confirmResetState,
  persistAppState,
  readStoredAppState,
} from "./app-state-storage";

interface AppStateContextValue {
  state: AppState;
  assessments: MaturationResult[];
  addRecord: (input: AnthropometricRecordInput) => boolean;
  importRecords: (rows: AnthropometricRecordInput[]) => number;
  updateRecord: (id: string, updates: Partial<AnthropometricRecordInput>) => void;
  addPerformanceEntry: (input: PerformanceEntryInput) => void;
  updatePerformanceEntry: (id: string, updates: Partial<PerformanceEntryInput>) => void;
  deletePerformanceEntry: (id: string) => void;
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

function reportPersistenceError(error: unknown) {
  console.error("[supabase] Persistence failed", error);
}

export function AppStateProvider({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: AppState;
}) {
  const [state, setState] = useState<AppState>(
    () => initialState ?? readStoredAppState(normalizeState),
  );

  useEffect(() => {
    if (initialState) return;
    persistAppState(state);
  }, [initialState, state]);

  const assessments = useMemo(
    () => state.records.map(calculateMaturation),
    [state.records],
  );

  const addRecord = useCallback((input: AnthropometricRecordInput) => {
    const duplicate = state.records.some(
      (record) =>
        record.athleteName.toLowerCase() === input.athleteName.toLowerCase() &&
        record.dataCollectionDate === input.dataCollectionDate,
    );

    if (duplicate) return false;

    startTransition(() => {
      setState((current) => {
        return addRecordToState(current, input).nextState;
      });
    });

    void addRecordAction(input).catch(reportPersistenceError);
    return true;
  }, [state.records]);

  const updateRecord = (id: string, updates: Partial<AnthropometricRecordInput>) => {
    setState((current) => updateRecordInState(current, id, updates));
    void updateRecordAction(id, updates).catch(reportPersistenceError);
  };

  const importRecords = useCallback((rows: AnthropometricRecordInput[]) => {
    let imported = 0;
    const existing = new Set(
      state.records.map(
        (record) =>
          `${record.athleteName.toLowerCase()}::${record.dataCollectionDate}`,
      ),
    );
    const rowsToPersist = rows.filter((row) => {
      const key = `${row.athleteName.toLowerCase()}::${row.dataCollectionDate}`;
      if (existing.has(key)) return false;
      existing.add(key);
      return true;
    });

    setState((current) => {
      const result = importRecordsToState(current, rows);
      imported = result.imported;
      return result.nextState;
    });

    rowsToPersist.forEach((row) => {
      void addRecordAction(row).catch(reportPersistenceError);
    });

    return imported;
  }, [state.records]);

  const addPerformanceEntry = (input: PerformanceEntryInput) => {
    setState((current) => addPerformanceEntryToState(current, input));
  };

  const importPerformanceEntries = (rows: PerformanceEntryInput[]) => {
    let imported = 0;

    setState((current) => {
      const result = importPerformanceEntriesToState(current, rows);
      imported = result.imported;
      return result.nextState;
    });

    return imported;
  };

  const updatePerformanceEntry = (id: string, updates: Partial<PerformanceEntryInput>) => {
    setState((current) => updatePerformanceEntryInState(current, id, updates));
  };

  const deletePerformanceEntry = (id: string) => {
    setState((current) => deletePerformanceEntryInState(current, id));
  };

  const setLocale = (locale: Locale) => {
    setState((current) => setLocaleInState(current, locale));

    void fetch("/api/users/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    });
  };

  const addTeam = (team: Omit<Team, "id">) => {
    setState((current) => addTeamToState(current, team));
    void addTeamAction(team).catch(reportPersistenceError);
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    setState((current) => updateTeamInState(current, id, updates));
    void updateTeamAction(id, updates).catch(reportPersistenceError);
  };

  const deleteTeam = (id: string) => {
    setState((current) => deleteTeamFromState(current, id));
    void deleteTeamAction(id).catch(reportPersistenceError);
  };

  const addAthlete = (athlete: Omit<Athlete, "id">) => {
    setState((current) => addAthleteToState(current, athlete));
    void addAthleteAction(athlete).catch(reportPersistenceError);
  };

  const updateAthlete = (id: string, updates: Partial<Athlete>) => {
    setState((current) => updateAthleteInState(current, id, updates));
    void updateAthleteAction(id, updates).catch(reportPersistenceError);
  };

  const deleteAthlete = (id: string) => {
    setState((current) => deleteAthleteFromState(current, id));
    void deleteAthleteAction(id).catch(reportPersistenceError);
  };

  const updateClub = (updates: Partial<Club>) => {
    setState((current) => updateClubInState(current, updates));
  };

  const addTrainingLoadEntry = (entry: Omit<TrainingLoadEntry, "id" | "load">) => {
    setState((current) => addTrainingLoadEntryToState(current, entry));
  };

  const deleteTrainingLoadEntry = (id: string) => {
    setState((current) => deleteTrainingLoadEntryFromState(current, id));
  };

  const addPerformanceDefinition = (definition: Omit<PerformanceDefinition, "id">) => {
    setState((current) => addPerformanceDefinitionToState(current, definition));
  };

  const updatePerformanceDefinition = (
    id: string,
    updates: Partial<PerformanceDefinition>,
  ) => {
    setState((current) => updatePerformanceDefinitionInState(current, id, updates));
  };

  const deletePerformanceDefinition = (id: string) => {
    setState((current) => deletePerformanceDefinitionFromState(current, id));
  };

  const value = useMemo<AppStateContextValue>(
    () => ({
      state,
      assessments,
      addRecord,
      updateRecord,
      importRecords,
      addPerformanceEntry,
      updatePerformanceEntry,
      deletePerformanceEntry,
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
        if (confirmResetState(state.preferences.locale)) {
          setState(resetAppState());
        }
      },
    }),
    [state, assessments, addRecord, importRecords],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used within AppStateProvider");
  return context;
}
