// API Route: Métricas de escucha
// POST /api/metrics — actualizar métricas de un episodio

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/metrics");

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
    const { episode_id, total_listen_time_seconds, completion_rate, playback_speed } = body;

    if (!episode_id) {
      return NextResponse.json(
        { error: "episode_id es requerido" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("listening_metrics")
      .upsert(
        {
          episode_id,
          user_id: user.id,
          total_listen_time_seconds: total_listen_time_seconds || 0,
          completion_rate: completion_rate || 0,
          playback_speed: playback_speed || 1.0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "episode_id,user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ metrics: data });
  } catch (error) {
    log.error("Error guardando métricas", error);
    return NextResponse.json(
      { error: "Error al guardar métricas" },
      { status: 500 }
    );
  }
}
