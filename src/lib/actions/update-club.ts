"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth";

export async function updateClubAction(updates: {
  name?: string;
  region?: string;
  sport?: "football" | "futsal" | null;
  accentColor?: string;
  badgeUrl?: string;
}): Promise<void> {
  const session = await requireSession();

  // Solo el owner puede editar los datos del club
  if (session.role !== "owner") {
    throw new Error("Solo el administrador puede editar los datos del club.");
  }

  const adminClient = createSupabaseAdminClient();

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined)        dbUpdates.name         = updates.name.trim();
  if (updates.region !== undefined)      dbUpdates.region       = updates.region.trim();
  if (updates.sport !== undefined)       dbUpdates.sport        = updates.sport ?? null;
  if (updates.accentColor !== undefined) dbUpdates.accent_color = updates.accentColor;
  if (updates.badgeUrl !== undefined)    dbUpdates.badge_url    = updates.badgeUrl;

  if (Object.keys(dbUpdates).length === 0) return;

  const { error } = await adminClient
    .from("clubs")
    .update(dbUpdates)
    .eq("id", session.clubId);

  if (error) {
    throw new Error(`Error al guardar los cambios del club: ${error.message}`);
  }
}