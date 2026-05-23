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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
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

type DbMember = {
  user_id: string;
  role: string;
  team_ids: string[] | null;
  created_at: string;
  can_edit_athletes: boolean | null;
  can_edit_anthropometry: boolean | null;
  can_edit_performance: boolean | null;
  can_edit_training_load: boolean | null;
};

type DbAuthUser = {
  id: string;
  email: string | null;
  raw_user_meta_data: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
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

/** Mapea el role de la BD ("owner" | "coach" | "analyst") al role de la UI ("admin" | "user") */
function dbRoleToUiRole(dbRole: string): "admin" | "user" {
  return dbRole === "owner" || dbRole === "admin" ? "admin" : "user";
}

function memberPermissions(member: DbMember): import("@/lib/types").ClubUserPermissions {
  return {
    canEditAthletes: member.can_edit_athletes ?? true,
    canEditAnthropometry: member.can_edit_anthropometry ?? true,
    canEditPerformance: member.can_edit_performance ?? true,
    canEditTrainingLoad: member.can_edit_training_load ?? true,
  };
}

function getAuthUserDisplayName(authUser: DbAuthUser | undefined): string | undefined {
  if (!authUser) return undefined;

  // Check raw_user_meta_data (which Supabase populates during invitation)
  if (authUser.raw_user_meta_data && typeof authUser.raw_user_meta_data === "object") {
    const rawName = 
      authUser.raw_user_meta_data["full_name"] ?? 
      authUser.raw_user_meta_data["fullName"] ?? 
      authUser.raw_user_meta_data["name"] ?? 
      authUser.raw_user_meta_data["display_name"] ?? 
      authUser.raw_user_meta_data["displayName"];
    if (typeof rawName === "string" && rawName.trim()) {
      return rawName.trim();
    }
  }

  // Check user_metadata (which we update via admin API)
  if (authUser.user_metadata && typeof authUser.user_metadata === "object") {
    const metaName = 
      authUser.user_metadata["full_name"] ?? 
      authUser.user_metadata["fullName"] ?? 
      authUser.user_metadata["name"] ?? 
      authUser.user_metadata["display_name"] ?? 
      authUser.user_metadata["displayName"];
    if (typeof metaName === "string" && metaName.trim()) {
      return metaName.trim();
    }
  }

  // Fallback to email prefix
  if (authUser.email) {
    return authUser.email.split("@")[0];
  }

  return undefined;
}

function mapMember(
  member: DbMember,
  clubId: string,
  session: SessionUser,
  authUser?: DbAuthUser,
): import("@/lib/types").ClubUser {
  const isSelf = member.user_id === session.id;
  const inviteName = getAuthUserDisplayName(authUser);

  return {
    id: member.user_id,
    clubId,
    name: isSelf
      ? session.email.split("@")[0] ?? "Usuario"
      : inviteName ?? `Usuario (${member.user_id.slice(0, 8)}…)`,
    email: isSelf ? session.email : authUser?.email ?? "",
    role: dbRoleToUiRole(member.role),
    assignedTeamIds: member.team_ids ?? [],
    permissions: memberPermissions(member),
    createdAt: member.created_at,
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
    membersData,
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
    safeQuery<DbMember[]>(
      "club_members.select",
      supabase
        .from("club_members")
        .select("user_id, role, team_ids, created_at, can_edit_athletes, can_edit_anthropometry, can_edit_performance, can_edit_training_load")
        .eq("club_id", session.clubId),
      [],
    ),
  ]);

  const adminSupabase = createSupabaseAdminClient();
  const memberIds = membersData.map((member) => member.user_id);
  let authUsersData: DbAuthUser[] = [];
  if (memberIds.length > 0) {
    try {
      const { data: listData, error: listError } = await adminSupabase.auth.admin.listUsers({
        limit: 1000,
      });
      if (listError) {
        console.warn("[supabase] auth.admin.listUsers failed:", listError.message);
      } else {
        authUsersData = (listData?.users ?? []).filter((u) => memberIds.includes(u.id));
      }
    } catch (err) {
      console.warn("[supabase] auth.admin.listUsers error:", err);
    }
  }
  const authUsersById = new Map(authUsersData.map((user) => [user.id, user]));

  const mappedClub = mapClub(club, session);
  const teams = teamsData.map(mapTeam);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const athletes = athletesData.map((athlete) => mapAthlete(athlete, mappedClub, teamsById));
  const athletesById = new Map(athletes.map((athlete) => [athlete.id, athlete]));
  const definitions = performanceDefinitionsData.map(mapPerformanceDefinition);

  // Rol real del usuario actual desde la sesión de Supabase
  const currentUserRole = dbRoleToUiRole(session.role);

  // team_ids del usuario actual (para el filtro de acceso por equipo)
  const currentMember = membersData.find((m) => m.user_id === session.id);
  const currentUserTeamIds = currentMember?.team_ids ?? [];
  const hasTeamRestrictions = currentMember && currentMember.team_ids && currentMember.team_ids.length > 0;
  const isAdmin = currentUserRole === "admin";

  // Permisos del usuario actual (admins/owners tienen todo)
  const currentUserPermissions = currentMember
    ? memberPermissions(currentMember)
    : { canEditAthletes: true, canEditAnthropometry: true, canEditPerformance: true, canEditTrainingLoad: true };

  const filteredTeams = isAdmin || !hasTeamRestrictions ? teams : teams.filter((team) => currentUserTeamIds.includes(team.id));
  const athleteAllowed = (athlete: Athlete) =>
    isAdmin || !hasTeamRestrictions || (athlete.teamId ? currentUserTeamIds.includes(athlete.teamId) : false);
  const filteredAthletes = athletes.filter(athleteAllowed);
  const athletesByIdFiltered = new Map(filteredAthletes.map((athlete) => [athlete.id, athlete]));

  const filteredRecords = recordsData
    .map((record) => mapRecord(record, mappedClub, athletesByIdFiltered))
    .filter((record) => {
      const athlete = athletesByIdFiltered.get(record.athleteId);
      return athlete ? athleteAllowed(athlete) : false;
    });
  const filteredPerformanceEntries = performanceEntriesData
    .map((entry) => mapPerformanceEntry(entry, athletesByIdFiltered))
    .filter((entry) => {
      const athlete = athletesByIdFiltered.get(entry.athleteId);
      return athlete ? athleteAllowed(athlete) : false;
    });
  const filteredTrainingLoadEntries = trainingLoadEntriesData
    .map(mapTrainingLoadEntry)
    .filter((entry) => {
      const athlete = athletesByIdFiltered.get(entry.athleteId);
      return athlete ? athleteAllowed(athlete) : false;
    });

  // Lista de todos los miembros del club (para la pestaña de administración)
  const clubUsers = membersData.map((member) =>
    mapMember(member, session.clubId, session, authUsersById.get(member.user_id)),
  );

  return {
    club: mappedClub,
    teams: filteredTeams,
    athletes: filteredAthletes,
    records: filteredRecords,
    performanceEntries: filteredPerformanceEntries,
    trainingLoadEntries: filteredTrainingLoadEntries,
    performanceDefinitions: definitions,
    preferences: {
      locale: preferences?.locale === "en" ? "en" : fallbackLocale,
    },
    clubUsers,
    currentUserRole,
    currentUserTeamIds,
    currentUserPermissions,
  };
}