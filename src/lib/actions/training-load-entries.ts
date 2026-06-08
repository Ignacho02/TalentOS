"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { TrainingLoadEntry } from "@/lib/types";
import { isUUID } from "@/lib/utils";
import { assertCanEditTrainingLoad, getClubMemberRow } from "@/lib/actions/club-member-access";

// ---------------------------------------------------------------------------
// Helper: TS → BD
// ---------------------------------------------------------------------------

function toLoadInsert(
  entry: Omit<TrainingLoadEntry, "id" | "load">,
  athleteId: string,
) {
  return {
    athlete_id: athleteId,
    date: entry.date,
    attended: entry.attended,
    session_type: entry.sessionType,
    minutes_played: entry.minutesPlayed,
    rpe: entry.rpe,
    // load se calcula en la BD como minutes_played * rpe, o lo guardamos calculado
    load: entry.minutesPlayed * entry.rpe,
    notes: entry.notes ?? null,
  };
}

// ---------------------------------------------------------------------------
// addTrainingLoadEntryAction
// ---------------------------------------------------------------------------

export async function addTrainingLoadEntryAction(
  entry: Omit<TrainingLoadEntry, "id" | "load">,
): Promise<{ id: string } | null> {
  const session = await requireSession();

  if (!isUUID(entry.athleteId)) {
    console.warn(`[addTrainingLoadEntryAction] athleteId inválido: ${entry.athleteId}`);
    return null;
  }

  await assertCanEditTrainingLoad(session, entry.athleteId);

  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("training_load_entries")
    .insert(toLoadInsert(entry, entry.athleteId))
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  return { id: data.id as string };
}

// ---------------------------------------------------------------------------
// deleteTrainingLoadEntryAction
// ---------------------------------------------------------------------------

export async function deleteTrainingLoadEntryAction(id: string): Promise<void> {
  const session = await requireSession();
  if (!isUUID(id)) return;

  const supabase = await createSupabaseClient();
  const { data: entry } = await supabase
    .from("training_load_entries")
    .select("athlete_id")
    .eq("id", id)
    .maybeSingle();

  if (!entry?.athlete_id) {
    throw new Error("Entrada de carga de entrenamiento no encontrada.");
  }

  await assertCanEditTrainingLoad(session, entry.athlete_id);

  const { error } = await supabase.from("training_load_entries").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
}

// ---------------------------------------------------------------------------
// importTrainingLoadEntriesAction
// Versión batch. Requiere que los athleteIds sean UUIDs válidos de la BD.
// ---------------------------------------------------------------------------

export async function importTrainingLoadEntriesAction(
  rows: Omit<TrainingLoadEntry, "id" | "load">[],
): Promise<{ imported: number; skipped: number }> {
  const session = await requireSession();
  const supabase = await createSupabaseClient();
  const member = await getClubMemberRow(session);

  const canEditTrainingLoad = member.role === "owner" || member.can_edit_training_load !== false;
  if (!canEditTrainingLoad) {
    throw new Error("No tienes permiso para importar entradas de carga de entrenamiento.");
  }

  // Verificar que los atletas existen en este club y están dentro del alcance del usuario
  const athleteIds = [...new Set(rows.map((r) => r.athleteId).filter(isUUID))];
  const athletesQuery = supabase
    .from("athletes")
    .select("id")
    .in("id", athleteIds)
    .eq("club_id", session.clubId);

  if (member.team_ids && member.team_ids.length > 0) {
    athletesQuery.in("team_id", member.team_ids);
  }

  const { data: existingAthletes } = await athletesQuery;
  const validIds = new Set((existingAthletes ?? []).map((a) => a.id as string));

  const inserts = rows
    .filter((row) => validIds.has(row.athleteId))
    .map((row) => toLoadInsert(row, row.athleteId));

  if (inserts.length === 0) {
    return { imported: 0, skipped: rows.length };
  }

  const { error } = await supabase.from("training_load_entries").insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath("/datahub");
  return { imported: inserts.length, skipped: rows.length - inserts.length };
}