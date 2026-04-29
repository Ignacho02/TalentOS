"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { Team } from "@/lib/types";

function toTeamInsert(team: Omit<Team, "id">, clubId: string) {
  return {
    club_id: clubId,
    name: team.name,
    age_group: team.ageGroup,
    photo_url: team.photoUrl ?? null,
  };
}

function toTeamUpdate(updates: Partial<Team>) {
  return {
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.ageGroup !== undefined ? { age_group: updates.ageGroup } : {}),
    ...(updates.photoUrl !== undefined ? { photo_url: updates.photoUrl ?? null } : {}),
  };
}

export async function addTeamAction(team: Omit<Team, "id">) {
  const session = await requireSession();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("teams")
    .insert(toTeamInsert(team, session.clubId))
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  return data;
}

export async function updateTeamAction(id: string, updates: Partial<Team>) {
  await requireSession();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("teams")
    .update(toTeamUpdate(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  return data;
}

export async function deleteTeamAction(id: string) {
  await requireSession();
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("teams").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
}
