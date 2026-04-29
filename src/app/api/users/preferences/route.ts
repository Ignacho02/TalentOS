import { NextRequest, NextResponse } from "next/server";
import { createSupabaseClient } from "@/lib/supabase/server";

export async function PATCH(request: NextRequest) {
  let body: { locale?: "es" | "en" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const locale = body.locale === "en" ? "en" : "es";
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { error } = await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, locale });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set("maduration_locale", locale, {
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
