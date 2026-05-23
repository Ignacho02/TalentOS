"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth";
import type { ClubUserPermissions, DEFAULT_USER_PERMISSIONS } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDbRole(frontendRole: "admin" | "user"): "owner" | "coach" {
  return frontendRole === "admin" ? "owner" : "coach";
}

// ---------------------------------------------------------------------------
// createClubUserAction
//
// FLUJO:
// 1. Intentamos invitar al usuario por email (inviteUserByEmail).
//    Supabase le manda un email con un magic link para que establezca su contraseña.
// 2. Si el email ya existe en Auth, hacemos lookup por email para obtener el user_id
//    y lo añadimos al club igualmente (puede ser un usuario de otro club o uno antiguo).
// 3. Insertamos en club_members con role, team_ids y permisos.
// ---------------------------------------------------------------------------

export async function createClubUserAction(input: {
  email: string;
  name: string;
  role: "admin" | "user";
  teamIds: string[];
  permissions: ClubUserPermissions;
}): Promise<{ id: string }> {
  const session = await requireSession();
  if (session.role !== "owner") {
    throw new Error("Solo el administrador del club puede crear usuarios.");
  }

  const adminClient = createSupabaseAdminClient();
  let newUserId: string;

  // Intentar invitar al usuario
  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    input.email.trim(),
    {
      data: { full_name: input.name.trim() },
      // redirectTo: puedes configurar la URL de tu app si quieres controlar la redirección
    },
  );

  if (inviteError) {
    // "User already registered" → buscamos su user_id por email
    if (
      inviteError.message.toLowerCase().includes("already") ||
      inviteError.message.toLowerCase().includes("registered") ||
      inviteError.message.toLowerCase().includes("exists")
    ) {
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existing = existingUsers?.users?.find(
        (u) => u.email?.toLowerCase() === input.email.trim().toLowerCase(),
      );
      if (!existing) {
        throw new Error(`No se pudo encontrar el usuario con email ${input.email}.`);
      }
      newUserId = existing.id;
    } else {
      throw new Error(`Error al invitar al usuario: ${inviteError.message}`);
    }
  } else {
    if (!inviteData?.user) throw new Error("Error desconocido al crear la invitación.");
    newUserId = inviteData.user.id;
  }

  // Comprobar que no está ya en este club
  const { data: existingMember } = await adminClient
    .from("club_members")
    .select("user_id")
    .eq("user_id", newUserId)
    .eq("club_id", session.clubId)
    .maybeSingle();

  if (existingMember) {
    throw new Error("Este usuario ya pertenece al club.");
  }

  // Insertar en club_members
  const { error: memberError } = await adminClient.from("club_members").insert({
    user_id: newUserId,
    club_id: session.clubId,
    role: toDbRole(input.role),
    team_ids: input.teamIds,
    can_edit_athletes: input.permissions.canEditAthletes,
    can_edit_anthropometry: input.permissions.canEditAnthropometry,
    can_edit_performance: input.permissions.canEditPerformance,
    can_edit_training_load: input.permissions.canEditTrainingLoad,
  });

  if (memberError) {
    throw new Error(`Error al asignar al usuario al club: ${memberError.message}`);
  }

  // Update auth user metadata to ensure display name is available
  // This ensures getAuthUserDisplayName() can find it later
  try {
    await adminClient.auth.admin.updateUserById(newUserId, {
      user_metadata: { full_name: input.name.trim() },
    });
  } catch (err) {
    console.warn("Could not update auth metadata for new user:", err);
  }

  return { id: newUserId };
}

// ---------------------------------------------------------------------------
// updateClubUserAction
// ---------------------------------------------------------------------------

export async function updateClubUserAction(input: {
  memberId: string;
  name?: string;
  role: "admin" | "user";
  teamIds: string[];
  permissions: ClubUserPermissions;
}): Promise<void> {
  const session = await requireSession();
  if (session.role !== "owner") throw new Error("No autorizado.");

  const adminClient = createSupabaseAdminClient();

  const { error } = await adminClient
    .from("club_members")
    .update({
      role: toDbRole(input.role),
      team_ids: input.teamIds,
      can_edit_athletes: input.permissions.canEditAthletes,
      can_edit_anthropometry: input.permissions.canEditAnthropometry,
      can_edit_performance: input.permissions.canEditPerformance,
      can_edit_training_load: input.permissions.canEditTrainingLoad,
    })
    .eq("user_id", input.memberId)
    .eq("club_id", session.clubId);

  if (error) throw new Error(`Error al actualizar el usuario: ${error.message}`);

  // If name is provided, sync it to auth user metadata
  if (input.name && input.name.trim()) {
    try {
      await adminClient.auth.admin.updateUserById(input.memberId, {
        user_metadata: { full_name: input.name.trim() },
      });
    } catch (err) {
      console.warn("Could not update auth metadata for user:", err);
    }
  }
}

// ---------------------------------------------------------------------------
// deleteClubUserAction
// ---------------------------------------------------------------------------

export async function deleteClubUserAction(memberId: string): Promise<void> {
  const session = await requireSession();
  if (session.role !== "owner") throw new Error("No autorizado.");
  if (memberId === session.id) throw new Error("No puedes eliminarte a ti mismo.");

  const adminClient = createSupabaseAdminClient();

  const { data: member, error: fetchError } = await adminClient
    .from("club_members")
    .select("user_id")
    .eq("user_id", memberId)
    .eq("club_id", session.clubId)
    .single();

  if (fetchError || !member) throw new Error("Usuario no encontrado en este club.");

  const { error: deleteError } = await adminClient
    .from("club_members")
    .delete()
    .eq("user_id", memberId)
    .eq("club_id", session.clubId);

  if (deleteError) throw new Error(`Error al eliminar al miembro: ${deleteError.message}`);

  // Borrar de Auth también
  const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(member.user_id);
  if (authDeleteError) {
    console.error(
      `[deleteClubUserAction] El miembro fue eliminado del club pero no de Auth: ${authDeleteError.message}`,
    );
  }
}