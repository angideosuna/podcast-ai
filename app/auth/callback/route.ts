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
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Comprobar si tiene preferences (= onboarding completado)
        const { data: prefsData } = await supabase
          .from("preferences")
          .select("id")
          .eq("user_id", user.id)
          .single();

        // Con preferences → dashboard, sin preferences → onboarding (paso 1: temas)
        const redirectTo = prefsData ? "/dashboard" : "/onboarding";

        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    }
  }

  // Si algo fallo, redirigir a login con error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
