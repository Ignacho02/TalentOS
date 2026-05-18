"use server";

import { cookies } from "next/headers";
import { requireSession } from "@/lib/auth";
import { loadAppStateForSession } from "@/lib/supabase/app-state";

export async function refreshAppStateAction() {
  const session = await requireSession();
  const cookieStore = await cookies();
  const fallbackLocale = cookieStore.get("maduration_locale")?.value === "en" ? "en" : "es";

  return loadAppStateForSession(session, fallbackLocale);
}
