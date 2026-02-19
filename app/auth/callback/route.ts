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
        // Comprobar en paralelo si tiene survey y preferences
        const [profileResult, preferencesResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("survey_completed")
            .eq("id", user.id)
            .single(),
          supabase
            .from("preferences")
            .select("id")
            .eq("user_id", user.id)
            .single(),
        ]);

        const hasSurvey = profileResult.data?.survey_completed === true;
        const hasPreferences = !!preferencesResult.data;

        let redirectTo: string;
        if (hasPreferences) {
          // Tiene todo completo → dashboard
          redirectTo = "/dashboard";
        } else if (hasSurvey) {
          // Tiene encuesta pero no preferences → saltar al paso 2
          redirectTo = "/onboarding?step=2";
        } else {
          // No tiene nada → onboarding desde el inicio
          redirectTo = next;
        }

        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    }
  }

  // Si algo fallo, redirigir a login con error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
