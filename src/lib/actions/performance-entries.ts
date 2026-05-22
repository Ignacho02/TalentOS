"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { PerformanceEntry, PerformanceEntryInput } from "@/lib/types";
import { isUUID } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helpers: TS → BD
// ---------------------------------------------------------------------------

function toEntryInsert(input: PerformanceEntryInput, athleteId: string) {
  return {
    athlete_id: athleteId,
    area: input.area,
    test_name: input.testName,
    unit: input.unit,
    value: input.value,
    measurement_date: input.measurementDate,
    notes: input.notes ?? null,
    rating_level: input.ratingLevel ?? null,
    rating_value: input.ratingValue ?? null,
    attempt_count: input.attemptCount ?? null,
    description: input.description ?? null,
    media_url: input.mediaUrl ?? null,
    media_type: input.mediaType ?? null,
  };
}

function toEntryUpdate(updates: Partial<PerformanceEntryInput>) {
  return {
    ...(updates.area !== undefined ? { area: updates.area } : {}),
    ...(updates.testName !== undefined ? { test_name: updates.testName } : {}),
    ...(updates.unit !== undefined ? { unit: updates.unit } : {}),
    ...(updates.value !== undefined ? { value: updates.value } : {}),
    ...(updates.measurementDate !== undefined ? { measurement_date: updates.measurementDate } : {}),
    ...(updates.notes !== undefined ? { notes: updates.notes ?? null } : {}),
    ...(updates.ratingLevel !== undefined ? { rating_level: updates.ratingLevel ?? null } : {}),
    ...(updates.ratingValue !== undefined ? { rating_value: updates.ratingValue ?? null } : {}),
    ...(updates.attemptCount !== undefined ? { attempt_count: updates.attemptCount ?? null } : {}),
    ...(updates.description !== undefined ? { description: updates.description ?? null } : {}),
    ...(updates.mediaUrl !== undefined ? { media_url: updates.mediaUrl ?? null } : {}),
    ...(updates.mediaType !== undefined ? { media_type: updates.mediaType ?? null } : {}),
  };
}

// ---------------------------------------------------------------------------
// Resolve athleteId desde el input (puede venir como string ID o como nombre)
// ---------------------------------------------------------------------------

async function resolveAthleteId(
  input: PerformanceEntryInput,
  clubId: string,
): Promise<string | null> {
  const supabase = await createSupabaseClient();

  // Si viene un ID válido, lo usamos directamente
  if (input.athleteId && isUUID(input.athleteId)) {
    const { data } = await supabase
      .from("athletes")
      .select("id")
      .eq("id", input.athleteId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  // Fallback: buscar por nombre en el club
  const { data } = await supabase
    .from("athletes")
    .select("id")
    .eq("name", input.athleteName)
    .maybeSingle();

  return (data?.id as string) ?? null;
}

// ---------------------------------------------------------------------------
// addPerformanceEntryAction
// ---------------------------------------------------------------------------

export async function addPerformanceEntryAction(
  input: PerformanceEntryInput,
): Promise<{ id: string } | null> {
  const session = await requireSession();
  const supabase = await createSupabaseClient();

  const athleteId = await resolveAthleteId(input, session.clubId);
  if (!athleteId) {
    // El atleta no existe en la BD todavía (puede pasar en imports)
    // No lanzamos error — simplemente no persistimos esta entrada
    console.warn(`[addPerformanceEntryAction] Atleta no encontrado: ${input.athleteName}`);
    return null;
  }

  const { data, error } = await supabase
    .from("performance_entries")
    .insert(toEntryInsert(input, athleteId))
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  revalidatePath("/analysis");
  return { id: data.id as string };
}

// ---------------------------------------------------------------------------
// updatePerformanceEntryAction
// ---------------------------------------------------------------------------

export async function updatePerformanceEntryAction(
  id: string,
  updates: Partial<PerformanceEntryInput>,
): Promise<void> {
  await requireSession();
  if (!isUUID(id)) return;

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("performance_entries")
    .update(toEntryUpdate(updates))
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  revalidatePath("/analysis");
}

// ---------------------------------------------------------------------------
// deletePerformanceEntryAction
// ---------------------------------------------------------------------------

export async function deletePerformanceEntryAction(id: string): Promise<void> {
  await requireSession();
  if (!isUUID(id)) return;

  const supabase = await createSupabaseClient();
  const { error } = await supabase.from("performance_entries").delete().eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  revalidatePath("/analysis");
}

// ---------------------------------------------------------------------------
// importPerformanceEntriesAction
// Versión batch para importaciones masivas. Ignora entradas cuyo atleta
// no existe en la BD (misma lógica que addRecordAction).
// ---------------------------------------------------------------------------

export async function importPerformanceEntriesAction(
  rows: PerformanceEntryInput[],
): Promise<{ imported: number; skipped: number }> {
  const session = await requireSession();
  const supabase = await createSupabaseClient();

  // Cargar todos los atletas del club de una sola query
  const { data: athletes } = await supabase
    .from("athletes")
    .select("id, name")
    .eq("club_id", session.clubId);

  const athleteMap = new Map<string, string>(
    (athletes ?? []).map((a) => [a.name.toLowerCase(), a.id as string]),
  );

  const inserts: ReturnType<typeof toEntryInsert>[] = [];

  for (const row of rows) {
    let athleteId: string | undefined;

    if (row.athleteId && isUUID(row.athleteId)) {
      athleteId = row.athleteId;
    } else {
      athleteId = athleteMap.get(row.athleteName.toLowerCase());
    }

    if (!athleteId) continue; // atleta no encontrado → skip
    inserts.push(toEntryInsert(row, athleteId));
  }

  if (inserts.length === 0) {
    return { imported: 0, skipped: rows.length };
  }

  const { error } = await supabase.from("performance_entries").insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath("/datahub");
  revalidatePath("/analysis");
  return { imported: inserts.length, skipped: rows.length - inserts.length };
}