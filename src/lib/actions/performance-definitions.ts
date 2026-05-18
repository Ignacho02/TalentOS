"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { PerformanceDefinition } from "@/lib/types";
import { isUUID } from "@/lib/utils";

function toDefinitionInsert(
  definition: Omit<PerformanceDefinition, "id">,
  clubId: string,
) {
  return {
    club_id: clubId,
    name: definition.name,
    name_key: definition.nameKey ?? null,
    area: definition.area,
    unit: definition.unit,
    attempts: definition.attempts,
    is_rating: definition.isRating,
    scoring_strategy: definition.scoringStrategy,
    interpretation: definition.interpretation,
    description: definition.description ?? null,
    description_key: definition.descriptionKey ?? null,
    media_url: definition.mediaUrl ?? null,
    media_type: definition.mediaType ?? null,
  };
}

function hasUpdate<K extends keyof PerformanceDefinition>(
  updates: Partial<PerformanceDefinition>,
  key: K,
) {
  return Object.prototype.hasOwnProperty.call(updates, key);
}

function toDefinitionUpdate(updates: Partial<PerformanceDefinition>) {
  return {
    ...(hasUpdate(updates, "name") ? { name: updates.name } : {}),
    ...(hasUpdate(updates, "nameKey") ? { name_key: updates.nameKey ?? null } : {}),
    ...(hasUpdate(updates, "area") ? { area: updates.area } : {}),
    ...(hasUpdate(updates, "unit") ? { unit: updates.unit } : {}),
    ...(hasUpdate(updates, "attempts") ? { attempts: updates.attempts } : {}),
    ...(hasUpdate(updates, "isRating") ? { is_rating: updates.isRating } : {}),
    ...(hasUpdate(updates, "scoringStrategy")
      ? { scoring_strategy: updates.scoringStrategy }
      : {}),
    ...(hasUpdate(updates, "interpretation")
      ? { interpretation: updates.interpretation }
      : {}),
    ...(hasUpdate(updates, "description")
      ? { description: updates.description ?? null }
      : {}),
    ...(hasUpdate(updates, "descriptionKey")
      ? { description_key: updates.descriptionKey ?? null }
      : {}),
    ...(hasUpdate(updates, "mediaUrl") ? { media_url: updates.mediaUrl ?? null } : {}),
    ...(hasUpdate(updates, "mediaType") ? { media_type: updates.mediaType ?? null } : {}),
  };
}

export async function addPerformanceDefinitionAction(
  definition: Omit<PerformanceDefinition, "id">,
) {
  const session = await requireSession();
  const supabase = await createSupabaseClient();
  const { data, error } = await supabase
    .from("performance_definitions")
    .insert(toDefinitionInsert(definition, session.clubId))
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  return data;
}

export async function updatePerformanceDefinitionAction(
  id: string,
  updates: Partial<PerformanceDefinition>,
) {
  await requireSession();
  const supabase = await createSupabaseClient();
  if (!isUUID(id)) return;

  const { data, error } = await supabase
    .from("performance_definitions")
    .update(toDefinitionUpdate(updates))
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
  return data;
}

export async function deletePerformanceDefinitionAction(id: string) {
  await requireSession();
  const supabase = await createSupabaseClient();
  if (!isUUID(id)) return;

  const { error } = await supabase
    .from("performance_definitions")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
}
