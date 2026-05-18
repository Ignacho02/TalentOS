import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // query RAW sin tabla tuya
  const { data, error } = await supabase.rpc('version')

  return Response.json({ data, error })
}