"use server";

import { revalidatePath } from "next/cache";
import { requireSession, type SessionUser } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { AnthropometricRecordInput } from "@/lib/types";
import { isUUID } from "@/lib/utils";
import { assertCanEditAnthropometry, assertCanEditAthletes } from "@/lib/actions/club-member-access";

async function ensureTeam(input: AnthropometricRecordInput, clubId: string) {
  if (!input.teamName) return null;

  const supabase = await createSupabaseClient();
  const { data: existing } = await supabase
    .from("teams")
    .select("id")
    .eq("name", input.teamName)
    .eq("club_id", clubId)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from("teams")
    .insert({
      club_id: clubId,
      name: input.teamName,
      age_group: input.ageGroup,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

async function ensureAthlete(input: AnthropometricRecordInput, session: SessionUser) {
  const supabase = await createSupabaseClient();

  if (input.athleteId && isUUID(input.athleteId)) {
    const { data } = await supabase
      .from("athletes")
      .select("id, club_id, team_id")
      .eq("id", input.athleteId)
      .maybeSingle();

    if (data?.id && data.club_id === session.clubId) {
      return data.id as string;
    }
  }

  const { data: existing } = await supabase
    .from("athletes")
    .select("id")
    .eq("name", input.athleteName)
    .eq("dob", input.dob)
    .eq("club_id", session.clubId)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const teamId = await ensureTeam(input, session.clubId);
  await assertCanEditAthletes(session as any, teamId);

  const { data, error } = await supabase
    .from("athletes")
    .insert({
      club_id: session.clubId,
      team_id: teamId,
      name: input.athleteName,
      sex: input.sex,
      age_group: input.ageGroup,
      dob: input.dob,
      position: input.position ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  return data.id as string;
}

function toRecordInsert(input: AnthropometricRecordInput, athleteId: string) {
  return {
    athlete_id: athleteId,
    collected_at: input.dataCollectionDate,
    stature_cm: input.statureCm,
    body_mass_kg: input.bodyMassKg,
    sitting_height_cm: input.sittingHeightCm,
    mother_height_cm: input.motherHeightCm ?? null,
    father_height_cm: input.fatherHeightCm ?? null,
  };
}

function toRecordUpdate(updates: Partial<AnthropometricRecordInput>) {
  return {
    ...(updates.dataCollectionDate !== undefined
      ? { collected_at: updates.dataCollectionDate }
      : {}),
    ...(updates.statureCm !== undefined ? { stature_cm: updates.statureCm } : {}),
    ...(updates.bodyMassKg !== undefined ? { body_mass_kg: updates.bodyMassKg } : {}),
    ...(updates.sittingHeightCm !== undefined
      ? { sitting_height_cm: updates.sittingHeightCm }
      : {}),
    ...(updates.motherHeightCm !== undefined
      ? { mother_height_cm: updates.motherHeightCm ?? null }
      : {}),
    ...(updates.fatherHeightCm !== undefined
      ? { father_height_cm: updates.fatherHeightCm ?? null }
      : {}),
  };
}

export async function addRecordAction(input: AnthropometricRecordInput) {
  const session = await requireSession();
  const supabase = await createSupabaseClient();
  const athleteId = await ensureAthlete(input, session);
  await assertCanEditAnthropometry(session, athleteId);
  const { data, error } = await supabase
    .from("anthropometric_records")
    .insert(toRecordInsert(input, athleteId))
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  revalidatePath("/analysis");
  return data;
}

export async function updateRecordAction(
  id: string,
  updates: Partial<AnthropometricRecordInput>,
) {
  const session = await requireSession();
  const supabase = await createSupabaseClient();
  if (!isUUID(id)) return;

  const { data: record } = await supabase
    .from("anthropometric_records")
    .select("athlete_id")
    .eq("id", id)
    .maybeSingle();

  if (!record?.athlete_id) {
    throw new Error("Registro no encontrado.");
  }

  await assertCanEditAnthropometry(session, record.athlete_id);

  const { data, error } = await supabase
    .from("anthropometric_records")
    .update(toRecordUpdate(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  revalidatePath("/analysis");
  return data;
}

export async function deleteRecordAction(id: string) {
  const session = await requireSession();
  const supabase = await createSupabaseClient();
  if (!isUUID(id)) return;

  const { data: record } = await supabase
    .from("anthropometric_records")
    .select("athlete_id")
    .eq("id", id)
    .maybeSingle();

  if (!record?.athlete_id) {
    throw new Error("Registro no encontrado.");
  }

  await assertCanEditAnthropometry(session, record.athlete_id);

  const { error } = await supabase.from("anthropometric_records").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  revalidatePath("/analysis");
}
