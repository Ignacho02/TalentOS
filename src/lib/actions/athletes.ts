"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { Athlete } from "@/lib/types";

function toAthleteInsert(athlete: Omit<Athlete, "id">, clubId: string) {
  return {
    club_id: clubId,
    team_id: athlete.teamId ?? null,
    name: athlete.name,
    sex: athlete.sex,
    age_group: athlete.ageGroup,
    dob: athlete.dob,
    position: athlete.position ?? null,
    photo_url: athlete.photoUrl ?? null,
    display_order: athlete.displayOrder ?? null,
    category: athlete.category ?? null,
  };
}

function toAthleteUpdate(updates: Partial<Athlete>) {
  return {
    ...(updates.teamId !== undefined ? { team_id: updates.teamId ?? null } : {}),
    ...(updates.name !== undefined ? { name: updates.name } : {}),
    ...(updates.sex !== undefined ? { sex: updates.sex } : {}),
    ...(updates.ageGroup !== undefined ? { age_group: updates.ageGroup } : {}),
    ...(updates.dob !== undefined ? { dob: updates.dob } : {}),
    ...(updates.position !== undefined ? { position: updates.position ?? null } : {}),
    ...(updates.photoUrl !== undefined ? { photo_url: updates.photoUrl ?? null } : {}),
    ...(updates.displayOrder !== undefined ? { display_order: updates.displayOrder ?? null } : {}),
    ...(updates.category !== undefined ? { category: updates.category ?? null } : {}),
  };
}

export async function addAthleteAction(athlete: Omit<Athlete, "id">) {
  const session = await requireSession();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("athletes")
    .insert(toAthleteInsert(athlete, session.clubId))
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  return data;
}

export async function updateAthleteAction(id: string, updates: Partial<Athlete>) {
  await requireSession();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("athletes")
    .update(toAthleteUpdate(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  return data;
}

export async function deleteAthleteAction(id: string) {
  await requireSession();
  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("athletes").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
}
