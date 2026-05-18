import { demoState } from "@/lib/demo-data";
import type {
  AppState,
  Athlete,
  Club,
  Locale,
  PerformanceArea,
  PerformanceDefinition,
  PerformanceEntry,
  Sex,
  Team,
  TrainingLoadEntry,
} from "@/lib/types";
import type { SessionUser } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/supabase/safe-query";

type DbClub = {
  id: string;
  name: string;
  region: string | null;
  sport: Club["sport"] | null;
  accent_color: string | null;
  badge_url: string | null;
};

type DbTeam = {
  id: string;
  club_id: string;
  name: string;
  age_group: string;
  photo_url: string | null;
};

type DbAthlete = {
  id: string;
  club_id: string;
  team_id: string | null;
  name: string;
  sex: Sex;
  age_group: string;
  position: string | null;
  photo_url: string | null;
  display_order: number | null;
  category: string | null;
  dob: string;
};

type DbRecord = {
  id: string;
  athlete_id: string;
  collected_at: string;
  stature_cm: number | string;
  body_mass_kg: number | string;
  sitting_height_cm: number | string;
  mother_height_cm: number | string | null;
  father_height_cm: number | string | null;
  created_at: string;
};

type DbPerformanceEntry = {
  id: string;
  athlete_id: string;
  area: PerformanceArea;
  test_name: string;
  unit: string;
  value: number | string;
  measurement_date: string;
  notes: string | null;
  rating_level: string | null;
  rating_value: number | string | null;
  attempt_count: number | null;
  description: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
  created_at: string;
};

type DbTrainingLoadEntry = {
  id: string;
  athlete_id: string;
  date: string;
  attended: boolean;
  session_type: "training" | "match";
  minutes_played: number;
  rpe: number;
  load: number;
  notes: string | null;
};

type DbPerformanceDefinition = {
  id: string;
  name: string;
  name_key: string | null;
  area: PerformanceArea;
  unit: string;
  attempts: number;
  is_rating: boolean;
  scoring_strategy: "best" | "average";
  interpretation: "higher_better" | "lower_better";
  description: string | null;
  description_key: string | null;
  media_url: string | null;
  media_type: "image" | "video" | null;
};

type SupabaseResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

function optionalNumber(value: number | string | null) {
  return value == null ? null : Number(value);
}

function logError(label: string, error: { message: string } | null | undefined) {
  if (error) {
    console.warn(`[supabase] ${label}: ${error.message}`);
  }
}

function mapClub(club: DbClub | null, session: SessionUser): Club {
  if (!club) {
    return {
      ...demoState.club,
      id: session.clubId,
      name: session.clubName,
    };
  }

  return {
    id: club.id,
    name: club.name,
    region: club.region ?? "",
    sport: club.sport ?? undefined,
    accentColor: club.accent_color ?? undefined,
    badgeUrl: club.badge_url ?? undefined,
  };
}

function mapTeam(team: DbTeam): Team {
  return {
    id: team.id,
    clubId: team.club_id,
    name: team.name,
    ageGroup: team.age_group,
    photoUrl: team.photo_url ?? undefined,
  };
}

function mapAthlete(athlete: DbAthlete, club: Club, teamsById: Map<string, Team>): Athlete {
  const team = athlete.team_id ? teamsById.get(athlete.team_id) : undefined;

  return {
    id: athlete.id,
    clubId: athlete.club_id,
    teamId: athlete.team_id ?? undefined,
    name: athlete.name,
    sex: athlete.sex,
    ageGroup: athlete.age_group,
    clubName: club.name,
    teamName: team?.name,
    position: athlete.position ?? undefined,
    dob: athlete.dob,
    photoUrl: athlete.photo_url ?? undefined,
    displayOrder: athlete.display_order ?? undefined,
    category: athlete.category ?? undefined,
  };
}

function mapRecord(record: DbRecord, club: Club, athletesById: Map<string, Athlete>) {
  const athlete = athletesById.get(record.athlete_id);

  return {
    id: record.id,
    athleteId: record.athlete_id,
    athleteName: athlete?.name ?? "Unknown athlete",
    sex: athlete?.sex ?? "male",
    ageGroup: athlete?.ageGroup ?? "",
    clubName: club.name,
    teamName: athlete?.teamName,
    position: athlete?.position,
    dob: athlete?.dob ?? "",
    dataCollectionDate: record.collected_at,
    statureCm: Number(record.stature_cm),
    bodyMassKg: Number(record.body_mass_kg),
    sittingHeightCm: Number(record.sitting_height_cm),
    motherHeightCm: optionalNumber(record.mother_height_cm),
    fatherHeightCm: optionalNumber(record.father_height_cm),
    createdAt: record.created_at,
  };
}

function mapPerformanceEntry(
  entry: DbPerformanceEntry,
  athletesById: Map<string, Athlete>,
): PerformanceEntry {
  const athlete = athletesById.get(entry.athlete_id);

  return {
    id: entry.id,
    athleteId: entry.athlete_id,
    athleteName: athlete?.name ?? "Unknown athlete",
    area: entry.area,
    teamName: athlete?.teamName,
    position: athlete?.position,
    testName: entry.test_name,
    unit: entry.unit,
    value: Number(entry.value),
    measurementDate: entry.measurement_date,
    notes: entry.notes ?? undefined,
    ratingLevel: entry.rating_level ?? undefined,
    ratingValue: optionalNumber(entry.rating_value) ?? undefined,
    attemptCount: entry.attempt_count ?? undefined,
    description: entry.description ?? undefined,
    mediaUrl: entry.media_url ?? undefined,
    mediaType: entry.media_type ?? undefined,
    createdAt: entry.created_at,
  };
}

function mapTrainingLoadEntry(entry: DbTrainingLoadEntry): TrainingLoadEntry {
  return {
    id: entry.id,
    athleteId: entry.athlete_id,
    date: entry.date,
    attended: entry.attended,
    sessionType: entry.session_type,
    minutesPlayed: entry.minutes_played,
    rpe: entry.rpe,
    load: entry.load,
    notes: entry.notes ?? undefined,
  };
}

function mapPerformanceDefinition(definition: DbPerformanceDefinition): PerformanceDefinition {
  return {
    id: definition.id,
    name: definition.name,
    nameKey: definition.name_key ?? undefined,
    area: definition.area,
    unit: definition.unit,
    attempts: definition.attempts,
    isRating: definition.is_rating,
    scoringStrategy: definition.scoring_strategy,
    interpretation: definition.interpretation,
    description: definition.description ?? undefined,
    descriptionKey: definition.description_key ?? undefined,
    mediaUrl: definition.media_url ?? undefined,
    mediaType: definition.media_type ?? undefined,
  };
}

async function safeQuery<T>(
  label: string,
  query: PromiseLike<SupabaseResult<T>>,
  fallback: T,
) {
  const result = await withTimeout(label, query, { data: fallback, error: null });
  logError(label, result.error);
  return result.data ?? fallback;
}

export async function loadAppStateForSession(
  session: SessionUser,
  fallbackLocale: Locale,
): Promise<AppState> {
  const supabase = await createSupabaseClient();

  const [
    club,
    teamsData,
    athletesData,
    recordsData,
    performanceEntriesData,
    trainingLoadEntriesData,
    performanceDefinitionsData,
    preferences,
  ] = await Promise.all([
    safeQuery<DbClub | null>(
      "clubs.select",
      supabase.from("clubs").select("*").eq("id", session.clubId).single(),
      null,
    ),
    safeQuery<DbTeam[]>(
      "teams.select",
      supabase.from("teams").select("*").eq("club_id", session.clubId).order("name"),
      [],
    ),
    safeQuery<DbAthlete[]>(
      "athletes.select",
      supabase.from("athletes").select("*").eq("club_id", session.clubId).order("name"),
      [],
    ),
    safeQuery<DbRecord[]>(
      "anthropometric_records.select",
      supabase
        .from("anthropometric_records")
        .select("*, athletes!inner(club_id)")
        .eq("athletes.club_id", session.clubId)
        .order("collected_at", { ascending: false }),
      [],
    ),
    safeQuery<DbPerformanceEntry[]>(
      "performance_entries.select",
      supabase
        .from("performance_entries")
        .select("*, athletes!inner(club_id)")
        .eq("athletes.club_id", session.clubId)
        .order("measurement_date", { ascending: false }),
      [],
    ),
    safeQuery<DbTrainingLoadEntry[]>(
      "training_load_entries.select",
      supabase
        .from("training_load_entries")
        .select("*, athletes!inner(club_id)")
        .eq("athletes.club_id", session.clubId)
        .order("date", { ascending: false }),
      [],
    ),
    safeQuery<DbPerformanceDefinition[]>(
      "performance_definitions.select",
      supabase
        .from("performance_definitions")
        .select("*")
        .eq("club_id", session.clubId)
        .order("name"),
      [],
    ),
    safeQuery<{ locale: Locale } | null>(
      "user_preferences.select",
      supabase.from("user_preferences").select("locale").eq("user_id", session.id).maybeSingle(),
      null,
    ),
  ]);

  const mappedClub = mapClub(club, session);
  const teams = teamsData.map(mapTeam);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const athletes = athletesData.map((athlete) => mapAthlete(athlete, mappedClub, teamsById));
  const athletesById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const definitions = performanceDefinitionsData.map(mapPerformanceDefinition);

  return {
    club: mappedClub,
    teams,
    athletes,
    records: recordsData.map((record) => mapRecord(record, mappedClub, athletesById)),
    performanceEntries: performanceEntriesData.map((entry) =>
      mapPerformanceEntry(entry, athletesById),
    ),
    trainingLoadEntries: trainingLoadEntriesData.map(mapTrainingLoadEntry),
    performanceDefinitions: definitions,
    preferences: {
      locale: preferences?.locale === "en" ? "en" : fallbackLocale,
    },
  };
}
