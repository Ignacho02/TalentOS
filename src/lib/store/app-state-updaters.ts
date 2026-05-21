import { demoState } from "@/lib/demo-data";
import type {
  AppState,
  AnthropometricRecord,
  AnthropometricRecordInput,
  Athlete,
  Club,
  ClubUser,
  Locale,
  PerformanceDefinition,
  PerformanceEntry,
  PerformanceEntryInput,
  Team,
  TrainingLoadEntry,
} from "@/lib/types";
import { uid } from "@/lib/utils";

function buildAthleteFromInput(
  state: AppState,
  input: AnthropometricRecordInput,
): { athlete: Athlete; team?: Team } {
  const athleteById = input.athleteId
    ? state.athletes.find((athlete) => athlete.id === input.athleteId)
    : undefined;

  if (athleteById) return { athlete: athleteById };

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
    createdAt: new Date().toISOString(),
    ...input,
    athleteId,
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

function fillMissingParentHeights(
  input: AnthropometricRecordInput,
  records: AnthropometricRecord[],
) {
  if (input.motherHeightCm != null && input.fatherHeightCm != null) {
    return input;
  }

  const previousRecords = records
    .filter((record) => record.athleteName.toLowerCase() === input.athleteName.toLowerCase())
    .sort((a, b) => b.dataCollectionDate.localeCompare(a.dataCollectionDate));

  const previousWithParents = previousRecords.find(
    (record) => record.motherHeightCm != null || record.fatherHeightCm != null,
  );

  if (!previousWithParents) {
    return input;
  }

  return {
    ...input,
    motherHeightCm: input.motherHeightCm ?? previousWithParents.motherHeightCm,
    fatherHeightCm: input.fatherHeightCm ?? previousWithParents.fatherHeightCm,
  };
}

function findAthleteForPerformanceEntry(
  state: AppState,
  input: PerformanceEntryInput,
) {
  return (
    state.athletes.find((item) => item.id === input.athleteId) ??
    state.athletes.find(
      (item) => item.name.toLowerCase() === input.athleteName.toLowerCase(),
    )
  );
}

export function addRecordToState(
  current: AppState,
  input: AnthropometricRecordInput,
): { nextState: AppState; added: boolean } {
  const duplicate = current.records.some(
    (record) =>
      record.athleteName.toLowerCase() === input.athleteName.toLowerCase() &&
      record.dataCollectionDate === input.dataCollectionDate,
  );

  if (duplicate) {
    return { nextState: current, added: false };
  }

  const { athlete, team } = buildAthleteFromInput(current, input);
  const enrichedInput = fillMissingParentHeights(input, current.records);

  return {
    added: true,
    nextState: {
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
    },
  };
}

export function updateRecordInState(
  current: AppState,
  id: string,
  updates: Partial<AnthropometricRecordInput>,
): AppState {
  return {
    ...current,
    records: current.records.map((record) =>
      record.id === id ? { ...record, ...updates } : record,
    ),
  };
}

export function importRecordsToState(
  current: AppState,
  rows: AnthropometricRecordInput[],
): { nextState: AppState; imported: number } {
  let imported = 0;
  const newTeams = new Map(current.teams.map((team) => [team.id, team]));
  const athleteMap = new Map(current.athletes.map((athlete) => [athlete.id, { ...athlete }]));
  const newRecords: AnthropometricRecord[] = [];

  for (const row of rows) {
    const duplicate = current.records.some(
      (record) =>
        record.athleteName.toLowerCase() === row.athleteName.toLowerCase() &&
        record.dataCollectionDate === row.dataCollectionDate,
    );
    if (duplicate) continue;

    const { athlete, team } = buildAthleteFromInput(
      {
        ...current,
        teams: Array.from(newTeams.values()),
        athletes: Array.from(athleteMap.values()),
      },
      row,
    );

    imported += 1;

    if (team && !newTeams.has(team.id)) {
      newTeams.set(team.id, team);
    }

    const existingAthlete = athleteMap.get(athlete.id);
    if (existingAthlete) {
      athleteMap.set(athlete.id, {
        ...existingAthlete,
        position: row.position || existingAthlete.position,
        teamName: row.teamName || existingAthlete.teamName,
      });
    } else {
      athleteMap.set(athlete.id, athlete);
    }

    const enrichedRow = fillMissingParentHeights(row, [...current.records, ...newRecords]);
    newRecords.push(buildRecord(athlete.id, enrichedRow));
  }

  return {
    imported,
    nextState: {
      ...current,
      teams: Array.from(newTeams.values()),
      athletes: Array.from(athleteMap.values()),
      records: [...current.records, ...newRecords],
    },
  };
}

export function addPerformanceEntryToState(
  current: AppState,
  input: PerformanceEntryInput,
): { nextState: AppState; added: boolean } {
  const athlete = findAthleteForPerformanceEntry(current, input);

  if (!athlete) {
    return { nextState: current, added: false };
  }

  return {
    added: true,
    nextState: {
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
    },
  };
}

export function importPerformanceEntriesToState(
  current: AppState,
  rows: PerformanceEntryInput[],
): { nextState: AppState; imported: number } {
  let imported = 0;
  const entries: PerformanceEntry[] = [];

  for (const row of rows) {
    const athlete = findAthleteForPerformanceEntry(current, row);
    if (!athlete) continue;

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
    return { nextState: current, imported };
  }

  return {
    imported,
    nextState: {
      ...current,
      performanceEntries: [...current.performanceEntries, ...entries],
    },
  };
}

export function updatePerformanceEntryInState(
  current: AppState,
  id: string,
  updates: Partial<PerformanceEntryInput>,
): AppState {
  return {
    ...current,
    performanceEntries: current.performanceEntries.map((entry) =>
      entry.id === id ? { ...entry, ...updates } : entry,
    ),
  };
}

export function deletePerformanceEntryInState(current: AppState, id: string): AppState {
  return {
    ...current,
    performanceEntries: current.performanceEntries.filter((entry) => entry.id !== id),
  };
}

export function setLocaleInState(current: AppState, locale: Locale): AppState {
  return {
    ...current,
    preferences: {
      ...current.preferences,
      locale,
    },
  };
}

export function addTeamToState(current: AppState, team: Omit<Team, "id">): AppState {
  return {
    ...current,
    teams: [...current.teams, { ...team, id: uid("team") }],
  };
}

export function updateTeamInState(
  current: AppState,
  id: string,
  updates: Partial<Team>,
): AppState {
  return {
    ...current,
    teams: current.teams.map((team) => (team.id === id ? { ...team, ...updates } : team)),
  };
}

export function deleteTeamFromState(current: AppState, id: string): AppState {
  return {
    ...current,
    teams: current.teams.filter((team) => team.id !== id),
    athletes: current.athletes.map((athlete) =>
      athlete.teamId === id ? { ...athlete, teamId: undefined, teamName: undefined } : athlete,
    ),
  };
}

export function addAthleteToState(
  current: AppState,
  athlete: Omit<Athlete, "id">,
): AppState {
  return {
    ...current,
    athletes: [...current.athletes, { ...athlete, id: uid("ath") }],
  };
}

export function updateAthleteInState(
  current: AppState,
  id: string,
  updates: Partial<Athlete>,
): AppState {
  return {
    ...current,
    athletes: current.athletes.map((athlete) =>
      athlete.id === id ? { ...athlete, ...updates } : athlete,
    ),
  };
}

export function deleteAthleteFromState(current: AppState, id: string): AppState {
  return {
    ...current,
    athletes: current.athletes.filter((athlete) => athlete.id !== id),
    records: current.records.filter((record) => record.athleteId !== id),
    performanceEntries: current.performanceEntries.filter((entry) => entry.athleteId !== id),
    trainingLoadEntries: current.trainingLoadEntries.filter((entry) => entry.athleteId !== id),
  };
}

export function updateClubInState(
  current: AppState,
  updates: Partial<Club>,
): AppState {
  return {
    ...current,
    club: { ...current.club, ...updates },
  };
}

export function addTrainingLoadEntryToState(
  current: AppState,
  entry: Omit<TrainingLoadEntry, "id" | "load">,
): AppState {
  const load = entry.attended ? entry.minutesPlayed * entry.rpe : 0;

  return {
    ...current,
    trainingLoadEntries: [
      ...current.trainingLoadEntries,
      { ...entry, id: uid("tl"), load },
    ],
  };
}

export function deleteTrainingLoadEntryFromState(
  current: AppState,
  id: string,
): AppState {
  return {
    ...current,
    trainingLoadEntries: current.trainingLoadEntries.filter((entry) => entry.id !== id),
  };
}

export function addPerformanceDefinitionToState(
  current: AppState,
  definition: Omit<PerformanceDefinition, "id">,
): AppState {
  return {
    ...current,
    performanceDefinitions: [
      ...current.performanceDefinitions,
      { ...definition, id: uid("pdef") },
    ],
  };
}

export function updatePerformanceDefinitionInState(
  current: AppState,
  id: string,
  updates: Partial<PerformanceDefinition>,
): AppState {
  return {
    ...current,
    performanceDefinitions: current.performanceDefinitions.map((definition) =>
      definition.id === id ? { ...definition, ...updates } : definition,
    ),
  };
}

export function deletePerformanceDefinitionFromState(
  current: AppState,
  id: string,
): AppState {
  return {
    ...current,
    performanceDefinitions: current.performanceDefinitions.filter(
      (definition) => definition.id !== id,
    ),
  };
}

export function resetAppState() {
  return demoState;
}

export function addClubUserToState(current: AppState, user: Omit<ClubUser, "id" | "createdAt">): AppState {
  const newUser: ClubUser = {
    ...user,
    id: uid("user"),
    createdAt: new Date().toISOString(),
  };
  return { ...current, clubUsers: [...current.clubUsers, newUser] };
}

export function updateClubUserInState(current: AppState, id: string, updates: Partial<Omit<ClubUser, "id" | "clubId" | "createdAt">>): AppState {
  return {
    ...current,
    clubUsers: current.clubUsers.map((u) => u.id === id ? { ...u, ...updates } : u),
  };
}

export function deleteClubUserFromState(current: AppState, id: string): AppState {
  return { ...current, clubUsers: current.clubUsers.filter((u) => u.id !== id) };
}

export function setCurrentUserRoleInState(current: AppState, role: AppState["currentUserRole"], teamIds: string[], permissions?: AppState["currentUserPermissions"]): AppState {
  return {
    ...current,
    currentUserRole: role,
    currentUserTeamIds: teamIds,
    ...(permissions ? { currentUserPermissions: permissions } : {}),
  };
}