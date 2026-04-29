import { NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createSupabaseClient();
  await supabase.auth.signOut();

  const response = NextResponse.json({ ok: true });
  response.cookies.set("maduration_session", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}
