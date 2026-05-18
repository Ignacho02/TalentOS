export async function GET() {
  return Response.json({
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  })
}