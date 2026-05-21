"use server";

import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth";

export type CreateClubInput = {
  name: string;
  region: string;
  sport: "football" | "futsal" | "";
  accentColor: string;
};

export type CreateClubError =
  | { field: "name"; message: string }
  | { field: "region"; message: string }
  | { field: "general"; message: string };

/**
 * Crea un nuevo club y vincula al usuario actual como "owner".
 * Retorna un array de errores de validación, o redirige a /hub si todo va bien.
 */
export async function createClubAction(
  input: CreateClubInput,
): Promise<CreateClubError[]> {
  // ── Validación básica ──────────────────────────────────────────────────────
  const errors: CreateClubError[] = [];

  const name = input.name.trim();
  const region = input.region.trim();

  if (!name) errors.push({ field: "name", message: "El nombre del club es obligatorio." });
  if (name.length > 80) errors.push({ field: "name", message: "Máximo 80 caracteres." });
  if (!region) errors.push({ field: "region", message: "La región es obligatoria." });
  if (region.length > 80) errors.push({ field: "region", message: "Máximo 80 caracteres." });

  if (errors.length > 0) return errors;

  // ── Sesión del usuario ─────────────────────────────────────────────────────
  const session = await getSessionUser();
  if (!session) {
    return [{ field: "general", message: "No autenticado. Por favor inicia sesión de nuevo." }];
  }

  // Si ya tiene club, no le dejamos crear otro (de momento, un usuario = un club)
  if (session.clubId) {
    return [{ field: "general", message: "Ya tienes un club creado." }];
  }

  // ── Inserción en BD ────────────────────────────────────────────────────────
  const adminClient = createSupabaseAdminClient();

  // 1. Crear el club
  const { data: club, error: clubError } = await adminClient
    .from("clubs")
    .insert({
      name,
      region,
      sport: input.sport || null,
      accent_color: input.accentColor || null,
    })
    .select("id")
    .single();

  if (clubError || !club) {
    console.error("[createClubAction] clubs.insert:", clubError);
    return [{ field: "general", message: "Error al crear el club. Inténtalo de nuevo." }];
  }

  // 2. Vincular al usuario como owner
  const { error: memberError } = await adminClient.from("club_members").insert({
    user_id: session.id,
    club_id: club.id,
    role: "owner",
    team_ids: [],
  });

  if (memberError) {
    // Rollback: borrar el club que acabamos de crear para no dejar datos huérfanos
    await adminClient.from("clubs").delete().eq("id", club.id);
    console.error("[createClubAction] club_members.insert:", memberError);
    return [{ field: "general", message: "Error al configurar el club. Inténtalo de nuevo." }];
  }

  // ── Éxito → redirigir a la app ─────────────────────────────────────────────
  // redirect() lanza internamente un error de Next.js, no puede estar dentro de try/catch
  redirect("/hub");
}