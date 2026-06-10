"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSupabaseClient } from "@/lib/supabase/server";
import type { GpsSession } from "@/lib/types";
import { isUUID } from "@/lib/utils";

// ---------------------------------------------------------------------------
// addGpsSessionAction
// Guarda la sesión (cabecera) y sus filas por jugador en tablas separadas.
// ---------------------------------------------------------------------------

export async function addGpsSessionAction(session: GpsSession): Promise<void> {
  const auth = await requireSession();
  const supabase = await createSupabaseClient();

  // 1. Insertar cabecera (sin rawRows — van en tabla hija)
  const { error: sessionError } = await supabase
    .from("gps_sessions")
    .insert({
      id:           session.id,
      club_id:      auth.clubId,
      team_id:      isUUID(session.teamId) ? session.teamId : null,
      date:         session.date,
      session_type: session.sessionType,
      file_name:    session.fileName,
      imported_at:  session.importedAt,
      notes:        session.notes ?? null,
      summary:      session.summary,
      raw_columns:  session.rawColumns,
    });

  if (sessionError) {
    console.error("[addGpsSessionAction] Error al guardar sesión:", sessionError);
    throw new Error(sessionError.message);
  }

  // 2. Insertar filas de jugadores (tabla hija)
  if (session.rawRows.length > 0) {
    const rowInserts = session.rawRows.map((row) => ({
      session_id:   session.id,
      athlete_id:   isUUID(String(row._athleteId ?? "")) ? String(row._athleteId) : null,
      athlete_name: String(row._athleteName ?? ""),
      // Guardamos el resto de columnas GPS en data, sin los campos internos _athleteId/_athleteName
      data: Object.fromEntries(
        Object.entries(row).filter(([k]) => !k.startsWith("_"))
      ),
    }));

    const { error: rowsError } = await supabase
      .from("gps_session_rows")
      .insert(rowInserts);

    if (rowsError) {
      console.error("[addGpsSessionAction] Error al guardar filas GPS:", rowsError);
      // No tiramos error aquí — la sesión ya se guardó; las filas son recuperables
      // pero logueamos para debugging
    }
  }

  revalidatePath("/datahub");
}

// ---------------------------------------------------------------------------
// deleteGpsSessionAction
// Las filas se borran en cascada por la FK con on delete cascade.
// ---------------------------------------------------------------------------

export async function deleteGpsSessionAction(id: string): Promise<void> {
  if (!isUUID(id)) return;
  await requireSession();

  const supabase = await createSupabaseClient();
  const { error } = await supabase
    .from("gps_sessions")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteGpsSessionAction] Error:", error);
    throw new Error(error.message);
  }

  revalidatePath("/datahub");
}