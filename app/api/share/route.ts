// API Route: Compartir/descompartir episodio
// POST /api/share — toggle sharing de un episodio

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/share");

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
    const { episode_id } = body;

    if (!episode_id) {
      return NextResponse.json(
        { error: "episode_id es requerido" },
        { status: 400 }
      );
    }

    // Obtener estado actual del episodio
    const { data: episode, error: fetchError } = await supabase
      .from("episodes")
      .select("id, is_shared")
      .eq("id", episode_id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !episode) {
      return NextResponse.json(
        { error: "Episodio no encontrado" },
        { status: 404 }
      );
    }

    const newShared = !episode.is_shared;

    const { error: updateError } = await supabase
      .from("episodes")
      .update({
        is_shared: newShared,
        shared_at: newShared ? new Date().toISOString() : null,
      })
      .eq("id", episode_id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      is_shared: newShared,
      share_url: newShared ? `/shared/${episode_id}` : null,
    });
  } catch (error) {
    log.error("Error compartiendo episodio", error);
    return NextResponse.json(
      { error: "Error al compartir episodio" },
      { status: 500 }
    );
  }
}
