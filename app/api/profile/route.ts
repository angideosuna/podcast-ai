// API Route: Gestionar perfil del usuario
// GET /api/profile — obtener perfil
// POST /api/profile — actualizar perfil

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/profile");

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
      .from("profiles")
      .select("nombre, empresa, rol, sector, edad, ciudad, nivel_conocimiento, objetivo_podcast, horario_escucha, survey_completed")
      .eq("id", user.id)
      .single();

    if (error) throw error;

    return NextResponse.json(
      { profile: { ...data, email: user.email } },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    log.error("Error obteniendo perfil", error);
    return NextResponse.json(
      { error: "Error al obtener perfil" },
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
    const {
      nombre,
      empresa,
      rol,
      sector,
      edad,
      ciudad,
      nivel_conocimiento,
      objetivo_podcast,
      horario_escucha,
      survey_completed,
    } = body;

    const updateData: Record<string, unknown> = {
      nombre,
      empresa,
      rol,
      sector,
      edad,
      ciudad,
      nivel_conocimiento,
      objetivo_podcast,
      horario_escucha,
      updated_at: new Date().toISOString(),
    };

    // Solo incluir survey_completed si viene explícitamente en el body
    if (survey_completed !== undefined) {
      updateData.survey_completed = survey_completed;
    }

    const { data, error } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ profile: data });
  } catch (error) {
    log.error("Error actualizando perfil", error);
    return NextResponse.json(
      { error: "Error al actualizar perfil" },
      { status: 500 }
    );
  }
}
