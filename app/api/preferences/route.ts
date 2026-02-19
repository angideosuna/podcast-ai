// API Route: Gestionar preferencias del usuario
// GET /api/preferences — obtener preferencias
// POST /api/preferences — guardar/actualizar preferencias

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/preferences");

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const { data, error } = await supabase
      .from("preferences")
      .select("topics, duration, tone, voice")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (es normal si es nuevo usuario)
      throw error;
    }

    return NextResponse.json({ preferences: data || null });
  } catch (error) {
    log.error("Error obteniendo preferencias", error);
    return NextResponse.json(
      { error: "Error al obtener preferencias" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "No autenticado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { topics, duration, tone, voice } = body;

    if (!topics?.length || !duration || !tone) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: topics, duration, tone" },
        { status: 400 }
      );
    }

    // Upsert: insertar o actualizar si ya existen
    const { data, error } = await supabase
      .from("preferences")
      .upsert(
        {
          user_id: user.id,
          topics,
          duration,
          tone,
          voice: voice || "female",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ preferences: data });
  } catch (error) {
    log.error("Error guardando preferencias", error);
    return NextResponse.json(
      { error: "Error al guardar preferencias" },
      { status: 500 }
    );
  }
}
