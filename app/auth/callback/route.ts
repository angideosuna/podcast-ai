// Callback de autenticacion de Supabase
// Maneja la confirmacion de email y redirecciones OAuth

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Comprobar si el usuario ya tiene preferencias
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: preferences } = await supabase
          .from("preferences")
          .select("id")
          .eq("user_id", user.id)
          .single();

        // Si ya tiene preferencias, ir al dashboard; si no, al onboarding
        const redirectTo = preferences ? "/dashboard" : next;
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    }
  }

  // Si algo fallo, redirigir a login con error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
