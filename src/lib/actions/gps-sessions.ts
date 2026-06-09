"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { GpsSession } from "@/lib/types";
import { isUUID } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Helper: TS → BD
// ---------------------------------------------------------------------------

function toGpsInsert(session: GpsSession, clubId: string) {
  return {
    id:           session.id,
    club_id:      clubId,
    team_id:      isUUID(session.teamId) ? session.teamId : null,
    date:         session.date,
    session_type: session.sessionType,
    file_name:    session.fileName,
    imported_at:  session.importedAt,
    notes:        session.notes ?? null,
    summary:      session.summary,
    raw_columns:  session.rawColumns,
    raw_rows:     session.rawRows,
  };
}

// ---------------------------------------------------------------------------
// addGpsSessionAction
// ---------------------------------------------------------------------------

export async function addGpsSessionAction(session: GpsSession): Promise<void> {
  const auth = await requireSession();

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("gps_sessions")
    .insert(toGpsInsert(session, auth.clubId));

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
}

// ---------------------------------------------------------------------------
// deleteGpsSessionAction
// ---------------------------------------------------------------------------

export async function deleteGpsSessionAction(id: string): Promise<void> {
  if (!isUUID(id)) return;
  await requireSession();

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("gps_sessions")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
  revalidatePath("/datahub");
}