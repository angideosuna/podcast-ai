// Utilidades de autenticación compartidas (lado cliente)

import { createClient } from "@/lib/supabase/client";

/**
 * Cierra la sesión del usuario y limpia el estado local.
 * Uso: await logout(); router.push("/login"); router.refresh();
 */
export async function logout(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
  localStorage.removeItem("podcast-ai-preferences");
}
