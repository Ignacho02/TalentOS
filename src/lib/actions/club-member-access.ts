"use server";

import { SessionUser } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";

type ClubMemberRow = {
  role: SessionUser["role"];
  team_ids: string[] | null;
  can_edit_athletes: boolean | null;
  can_edit_anthropometry: boolean | null;
  can_edit_performance: boolean | null;
  can_edit_training_load: boolean | null;
};

type ClubPermissionKey =
  | "can_edit_athletes"
  | "can_edit_anthropometry"
  | "can_edit_performance"
  | "can_edit_training_load";

function isClubAdmin(member: ClubMemberRow | null | undefined) {
  return !!member && member.role === "owner";
}

function hasPermission(member: ClubMemberRow | null, permission: ClubPermissionKey) {
  if (isClubAdmin(member)) return true;
  return member?.[permission] ?? true;
}

function isTeamAllowed(member: ClubMemberRow | null, teamId: string | null | undefined) {
  if (isClubAdmin(member)) return true;
  if (!member) return false;
  if (!member.team_ids || member.team_ids.length === 0) return true;
  if (!teamId) return false;
  return member.team_ids.includes(teamId);
}

export async function getClubMemberRow(session: SessionUser): Promise<ClubMemberRow> {
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("club_members")
    .select(
      "role, team_ids, can_edit_athletes, can_edit_anthropometry, can_edit_performance, can_edit_training_load",
    )
    .eq("user_id", session.id)
    .eq("club_id", session.clubId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Club membership not found for current user.");
  }

  return data as ClubMemberRow;
}

export async function assertCanEditAthletes(session: SessionUser, teamId: string | null | undefined) {
  const member = await getClubMemberRow(session);
  if (!hasPermission(member, "can_edit_athletes")) {
    throw new Error("No tienes permiso para editar jugadores.");
  }
  if (!isTeamAllowed(member, teamId)) {
    throw new Error("No tienes acceso a ese equipo.");
  }
  return member;
}

export async function assertCanEditAnthropometry(session: SessionUser, athleteId: string) {
  const member = await getClubMemberRow(session);
  if (!hasPermission(member, "can_edit_anthropometry")) {
    throw new Error("No tienes permiso para editar mediciones antropométricas.");
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("athletes")
    .select("id, team_id, club_id")
    .eq("id", athleteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.club_id !== session.clubId) {
    throw new Error("Atleta no encontrado en el club.");
  }
  if (!isTeamAllowed(member, data.team_id)) {
    throw new Error("No tienes acceso a ese atleta.");
  }

  return member;
}

export async function assertCanEditPerformance(session: SessionUser, athleteId: string) {
  const member = await getClubMemberRow(session);
  if (!hasPermission(member, "can_edit_performance")) {
    throw new Error("No tienes permiso para editar entradas de rendimiento.");
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("athletes")
    .select("id, team_id, club_id")
    .eq("id", athleteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.club_id !== session.clubId) {
    throw new Error("Atleta no encontrado en el club.");
  }
  if (!isTeamAllowed(member, data.team_id)) {
    throw new Error("No tienes acceso a ese atleta.");
  }

  return member;
}

export async function assertCanEditTrainingLoad(session: SessionUser, athleteId: string) {
  const member = await getClubMemberRow(session);
  if (!hasPermission(member, "can_edit_training_load")) {
    throw new Error("No tienes permiso para editar registros de carga de entrenamiento.");
  }

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("athletes")
    .select("id, team_id, club_id")
    .eq("id", athleteId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data || data.club_id !== session.clubId) {
    throw new Error("Atleta no encontrado en el club.");
  }
  if (!isTeamAllowed(member, data.team_id)) {
    throw new Error("No tienes acceso a ese atleta.");
  }

  return member;
}
