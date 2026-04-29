import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/server";
import { withTimeout } from "@/lib/supabase/safe-query";

export interface SessionUser {
  id: string;
  email: string;
  clubId: string;
  clubName: string;
  role: "owner" | "coach" | "analyst";
}

type AuthUserResult = {
  data: { user: User | null };
  error: { message: string } | null;
};

type MemberResult = {
  data: { club_id: string; role: SessionUser["role"] } | null;
  error: { message: string } | null;
};

type ClubResult = {
  data: { name: string } | null;
  error: { message: string } | null;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const hasSupabaseSession = cookieStore
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("auth-token"));

  if (!hasSupabaseSession) return null;

  const supabase = await createSupabaseClient();
  const authResult = await withTimeout<AuthUserResult>(
    "auth.getUser",
    supabase.auth.getUser(),
    { data: { user: null }, error: null },
    10000,
  );
  const user = authResult.data.user;

  if (!user?.email) return null;

  const { data: member, error: memberError } = await withTimeout<MemberResult>(
    "club_members.select",
    supabase
      .from("club_members")
      .select("club_id, role")
      .eq("user_id", user.id)
      .single(),
    { data: null, error: { message: "Timed out loading club membership" } },
    10000,
  );

  if (memberError || !member) {
    return null;
  }

  const { data: club } = await withTimeout<ClubResult>(
    "clubs.select(session)",
    supabase.from("clubs").select("name").eq("id", member.club_id).maybeSingle(),
    { data: null, error: null },
  );

  return {
    id: user.id,
    email: user.email,
    clubId: member.club_id,
    clubName: club?.name ?? "Maduration Club",
    role: member.role,
  };
}

export async function requireSession() {
  const session = await getSessionUser();
  if (!session) redirect("/login");
  return session;
}
