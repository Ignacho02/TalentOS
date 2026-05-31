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
import { refreshAppStateAction } from "@/lib/actions/app-state";
import {
  addAthleteAction,
  deleteAthleteAction,
  updateAthleteAction,
} from "@/lib/actions/athletes";
import {
  addRecordAction,
  updateRecordAction,
} from "@/lib/actions/records";
import {
  addPerformanceDefinitionAction,
  deletePerformanceDefinitionAction,
  updatePerformanceDefinitionAction,
} from "@/lib/actions/performance-definitions";
import { addTeamAction, deleteTeamAction, updateTeamAction } from "@/lib/actions/teams";
import {
  addPerformanceEntryAction,
  updatePerformanceEntryAction,
  deletePerformanceEntryAction,
  importPerformanceEntriesAction,
} from "@/lib/actions/performance-entries";
import {
  addTrainingLoadEntryAction,
  deleteTrainingLoadEntryAction,
  importTrainingLoadEntriesAction,
} from "@/lib/actions/training-load-entries";
import type {
  AppState,
  AnthropometricRecordInput,
  Athlete,
  Club,
  ClubUser,
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
  addClubUserToState,
  addPerformanceDefinitionToState,
  addPerformanceEntryToState,
  addRecordToState,
  addTeamToState,
  addTrainingLoadEntryToState,
  deleteAthleteFromState,
  deleteClubUserFromState,
  deletePerformanceDefinitionFromState,
  deletePerformanceEntryInState,
  deleteTeamFromState,
  deleteTrainingLoadEntryFromState,
  importPerformanceEntriesToState,
  importRecordsToState,
  resetAppState,
  setCurrentUserRoleInState,
  setLocaleInState,
  updateAthleteInState,
  updateClubInState,
  updateClubUserInState,
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
import { updateClubAction } from "@/lib/actions/update-club";

interface AppStateContextValue {
  state: AppState;
  assessments: MaturationResult[];
  addRecord: (input: AnthropometricRecordInput) => boolean;
  importRecords: (rows: AnthropometricRecordInput[]) => number;
  updateRecord: (id: string, updates: Partial<AnthropometricRecordInput>) => void;
  addPerformanceEntry: (input: PerformanceEntryInput) => boolean;
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
  addClubUser: (user: Omit<ClubUser, "id" | "createdAt">) => void;
  updateClubUser: (id: string, updates: Partial<Omit<ClubUser, "id" | "clubId" | "createdAt">>) => void;
  deleteClubUser: (id: string) => void;
  setCurrentUserRole: (role: AppState["currentUserRole"], teamIds: string[]) => void;
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

  // Apply the club's accent color as CSS variables on load and whenever it changes
  useEffect(() => {
    const color = state.club?.accentColor;
    if (!color || typeof window === "undefined") return;
    function adjustHex(hex: string, amount: number): string {
      const num = parseInt(hex.replace("#", ""), 16);
      const r = Math.min(255, Math.max(0, (num >> 16) + amount));
      const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
      const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
      return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
    }
    const root = document.documentElement;
    root.style.setProperty("--accent", color);
    root.style.setProperty("--accent-strong", adjustHex(color, -20));
    root.style.setProperty("--accent-soft", `${color}1a`);
  }, [state.club?.accentColor]);

  const assessments = useMemo(
    () => state.records.map(calculateMaturation),
    [state.records],
  );

  const syncPersistedState = useCallback(() => {
    return refreshAppStateAction()
      .then((freshState) => {
        startTransition(() => {
          setState((current) => ({
            ...current,
            club: freshState.club,
            teams: freshState.teams,
            athletes: freshState.athletes,
            records: freshState.records,
            performanceEntries: freshState.performanceEntries,
            trainingLoadEntries: freshState.trainingLoadEntries,
            performanceDefinitions: freshState.performanceDefinitions,
            preferences: freshState.preferences,
          }));
        });
      })
      .catch(reportPersistenceError);
  }, []);

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

    void addRecordAction(input)
      .then(syncPersistedState)
      .catch((error) => {
        reportPersistenceError(error);
        void syncPersistedState();
      });
    return true;
  }, [state.records, syncPersistedState]);

  const updateRecord = (id: string, updates: Partial<AnthropometricRecordInput>) => {
    setState((current) => updateRecordInState(current, id, updates));
    void updateRecordAction(id, updates)
      .then(syncPersistedState)
      .catch((error) => {
        reportPersistenceError(error);
        void syncPersistedState();
      });
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

    if (rowsToPersist.length > 0) {
      void Promise.allSettled(rowsToPersist.map((row) => addRecordAction(row)))
        .then((results) => {
          results.forEach((result) => {
            if (result.status === "rejected") {
              reportPersistenceError(result.reason);
            }
          });
          return syncPersistedState();
        })
        .catch(reportPersistenceError);
    }

    return imported;
  }, [state.records, syncPersistedState]);

  const addPerformanceEntry = (input: PerformanceEntryInput) => {
    let added = false;
    setState((current) => {
      const result = addPerformanceEntryToState(current, input);
      added = result.added;
      return result.nextState;
    });
    if (added) {
      void addPerformanceEntryAction(input).catch(reportPersistenceError);
    }
    return added;
  };

  const importPerformanceEntries = (rows: PerformanceEntryInput[]) => {
    let imported = 0;

    setState((current) => {
      const result = importPerformanceEntriesToState(current, rows);
      imported = result.imported;
      return result.nextState;
    });

    if (rows.length > 0) {
      void importPerformanceEntriesAction(rows).catch(reportPersistenceError);
    }

    return imported;
  };

  const updatePerformanceEntry = (id: string, updates: Partial<PerformanceEntryInput>) => {
    setState((current) => updatePerformanceEntryInState(current, id, updates));
    void updatePerformanceEntryAction(id, updates).catch(reportPersistenceError);
  };

  const deletePerformanceEntry = (id: string) => {
    setState((current) => deletePerformanceEntryInState(current, id));
    void deletePerformanceEntryAction(id).catch(reportPersistenceError);
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
    // Persistir en Supabase (fire-and-forget, el estado local ya se actualizó)
    updateClubAction({
      name: updates.name,
      region: updates.region,
      sport: updates.sport,
      accentColor: updates.accentColor,
      badgeUrl: updates.badgeUrl,
    }).catch((err) => {
      reportPersistenceError(err);
    });
  };

  const addTrainingLoadEntry = (entry: Omit<TrainingLoadEntry, "id" | "load">) => {
    setState((current) => addTrainingLoadEntryToState(current, entry));
    void addTrainingLoadEntryAction(entry).catch(reportPersistenceError);
  };

  const deleteTrainingLoadEntry = (id: string) => {
    setState((current) => deleteTrainingLoadEntryFromState(current, id));
    void deleteTrainingLoadEntryAction(id).catch(reportPersistenceError);
  };

  const addPerformanceDefinition = (definition: Omit<PerformanceDefinition, "id">) => {
    setState((current) => addPerformanceDefinitionToState(current, definition));
    void addPerformanceDefinitionAction(definition)
      .then(syncPersistedState)
      .catch((error) => {
        reportPersistenceError(error);
        void syncPersistedState();
      });
  };

  const updatePerformanceDefinition = (
    id: string,
    updates: Partial<PerformanceDefinition>,
  ) => {
    setState((current) => updatePerformanceDefinitionInState(current, id, updates));
    void updatePerformanceDefinitionAction(id, updates)
      .then(syncPersistedState)
      .catch((error) => {
        reportPersistenceError(error);
        void syncPersistedState();
      });
  };

  const deletePerformanceDefinition = (id: string) => {
    setState((current) => deletePerformanceDefinitionFromState(current, id));
    void deletePerformanceDefinitionAction(id)
      .then(syncPersistedState)
      .catch((error) => {
        reportPersistenceError(error);
        void syncPersistedState();
      });
  };

  const addClubUser = (user: Omit<ClubUser, "id" | "createdAt">) => {
    setState((current) => addClubUserToState(current, user));
  };

  const updateClubUser = (id: string, updates: Partial<Omit<ClubUser, "id" | "clubId" | "createdAt">>) => {
    setState((current) => updateClubUserInState(current, id, updates));
  };

  const deleteClubUser = (id: string) => {
    setState((current) => deleteClubUserFromState(current, id));
  };

  const setCurrentUserRole = (role: AppState["currentUserRole"], teamIds: string[]) => {
    setState((current) => setCurrentUserRoleInState(current, role, teamIds));
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
      addClubUser,
      updateClubUser,
      deleteClubUser,
      setCurrentUserRole,
      resetState: () => {
        if (confirmResetState(state.preferences.locale)) {
          setState(resetAppState());
        }
      },
    }),
    [
      state,
      assessments,
      addRecord,
      updateRecord,
      importRecords,
      addPerformanceDefinition,
      updatePerformanceDefinition,
      deletePerformanceDefinition,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) throw new Error("useAppState must be used within AppStateProvider");
  return context;
}