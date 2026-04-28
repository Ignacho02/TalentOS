"use client";

import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { calculateMaturation } from "@/lib/maturation/calculations";
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

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => readStoredAppState(normalizeState));

  useEffect(() => {
    persistAppState(state);
  }, [state]);

  const assessments = useMemo(
    () => state.records.map(calculateMaturation),
    [state.records],
  );

  const addRecord = (input: AnthropometricRecordInput) => {
    let added = false;

    startTransition(() => {
      setState((current) => {
        const result = addRecordToState(current, input);
        added = result.added;
        return result.nextState;
      });
    });

    return added;
  };

  const updateRecord = (id: string, updates: Partial<AnthropometricRecordInput>) => {
    setState((current) => updateRecordInState(current, id, updates));
  };

  const importRecords = (rows: AnthropometricRecordInput[]) => {
    let imported = 0;

    setState((current) => {
      const result = importRecordsToState(current, rows);
      imported = result.imported;
      return result.nextState;
    });

    return imported;
  };

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
  };

  const updateTeam = (id: string, updates: Partial<Team>) => {
    setState((current) => updateTeamInState(current, id, updates));
  };

  const deleteTeam = (id: string) => {
    setState((current) => deleteTeamFromState(current, id));
  };

  const addAthlete = (athlete: Omit<Athlete, "id">) => {
    setState((current) => addAthleteToState(current, athlete));
  };

  const updateAthlete = (id: string, updates: Partial<Athlete>) => {
    setState((current) => updateAthleteInState(current, id, updates));
  };

  const deleteAthlete = (id: string) => {
    setState((current) => deleteAthleteFromState(current, id));
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
    [state, assessments],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used within AppStateProvider");
  return context;
}
