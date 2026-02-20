// Cliente de Supabase con service_role key (bypasses RLS)
// Para usar en Server Components y API routes que necesitan acceso público

import { createClient } from "@supabase/supabase-js";

export function createServerComponentClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
