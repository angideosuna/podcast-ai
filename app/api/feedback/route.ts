// API Route: Feedback de episodios
// GET /api/feedback — últimos 20 feedbacks del usuario
// POST /api/feedback — guardar/actualizar feedback

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/feedback");

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("episode_feedback")
      .select("*, episodes(title, topics, tone, duration)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    return NextResponse.json({ feedback: data });
  } catch (error) {
    log.error("Error obteniendo feedback", error);
    return NextResponse.json(
      { error: "Error al obtener feedback" },
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
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const { episode_id, rating, tags, comment } = body;

    // Validar
    if (!episode_id || !rating) {
      return NextResponse.json(
        { error: "episode_id y rating son requeridos" },
        { status: 400 }
      );
    }

    if (![1, 5].includes(rating)) {
      return NextResponse.json(
        { error: "rating debe ser 1 o 5" },
        { status: 400 }
      );
    }

    if (comment && comment.length > 200) {
      return NextResponse.json(
        { error: "comment máximo 200 caracteres" },
        { status: 400 }
      );
    }

    // Verificar que el episodio pertenece al usuario
    const { data: episode } = await supabase
      .from("episodes")
      .select("id")
      .eq("id", episode_id)
      .eq("user_id", user.id)
      .single();

    if (!episode) {
      return NextResponse.json(
        { error: "Episodio no encontrado" },
        { status: 404 }
      );
    }

    // Upsert feedback
    const { data, error } = await supabase
      .from("episode_feedback")
      .upsert(
        {
          episode_id,
          user_id: user.id,
          rating,
          tags: tags || [],
          comment: comment || null,
        },
        { onConflict: "episode_id,user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ feedback: data });
  } catch (error) {
    log.error("Error guardando feedback", error);
    return NextResponse.json(
      { error: "Error al guardar feedback" },
      { status: 500 }
    );
  }
}
