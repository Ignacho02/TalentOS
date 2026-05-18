import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { error } = await supabase
      .from('clubs')
      .select('id')
      .limit(1)

    if (error) {
      return Response.json(
        { ok: false, error: error.message },
        { status: 500 }
      )
    }

    return Response.json({ ok: true })

  } catch (err) {
    return Response.json(
      { ok: false },
      { status: 500 }
    )
  }
}