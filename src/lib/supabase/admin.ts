import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase con la clave service_role.
 *
 * IMPORTANTE:
 * - Este cliente salta el RLS completamente (lee y escribe todo).
 * - NUNCA lo importes en un Client Component ni lo expongas al navegador.
 * - Solo úsalo en Server Actions o Route Handlers (código que corre en el servidor).
 * - La variable SUPABASE_SERVICE_ROLE_KEY NUNCA debe tener el prefijo NEXT_PUBLIC_.
 *
 * Dónde conseguir la clave:
 *   Supabase Dashboard → tu proyecto → Settings → API → "service_role" (secret)
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Faltan variables de entorno: NEXT_PUBLIC_SUPABASE_URL y/o SUPABASE_SERVICE_ROLE_KEY. " +
        "Añádelas a tu .env.local y a las variables de entorno de producción (Vercel, Railway, etc.).",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      // El cliente admin no necesita gestionar sesiones de usuario
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}