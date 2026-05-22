"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { TrainingLoadEntry } from "@/lib/types";
import { isUUID } from "@/lib/utils";

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
  await requireSession();
  if (!isUUID(id)) return;

  const supabase = await createSupabaseClient();
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

  // Verificar que los atletas existen en este club
  const athleteIds = [...new Set(rows.map((r) => r.athleteId).filter(isUUID))];

  const { data: existingAthletes } = await supabase
    .from("athletes")
    .select("id")
    .in("id", athleteIds)
    .eq("club_id", session.clubId);

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