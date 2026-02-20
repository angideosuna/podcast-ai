// API Route: Gestionar horario de generación automática
// GET /api/schedule — obtener schedule del usuario
// POST /api/schedule — crear o actualizar schedule

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/schedule");

const VALID_FREQUENCIES = ["daily", "weekdays", "custom"];

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
      .from("schedules")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (not an error, just no schedule)
      throw error;
    }

    return NextResponse.json({ schedule: data || null });
  } catch (error) {
    log.error("Error obteniendo schedule", error);
    return NextResponse.json(
      { error: "Error al obtener schedule" },
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
    const { time, frequency, custom_days, is_active } = body;

    // Validar time (HH:MM format)
    if (time && !/^\d{2}:\d{2}$/.test(time)) {
      return NextResponse.json(
        { error: "time debe tener formato HH:MM" },
        { status: 400 }
      );
    }

    // Validar frequency
    if (frequency && !VALID_FREQUENCIES.includes(frequency)) {
      return NextResponse.json(
        { error: `frequency debe ser uno de: ${VALID_FREQUENCIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Validar custom_days (0-6, Sunday=0)
    if (custom_days && Array.isArray(custom_days)) {
      if (!custom_days.every((d: number) => Number.isInteger(d) && d >= 0 && d <= 6)) {
        return NextResponse.json(
          { error: "custom_days debe ser un array de enteros 0-6" },
          { status: 400 }
        );
      }
    }

    const upsertData: Record<string, unknown> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (time !== undefined) upsertData.time = time;
    if (frequency !== undefined) upsertData.frequency = frequency;
    if (custom_days !== undefined) upsertData.custom_days = custom_days;
    if (is_active !== undefined) upsertData.is_active = is_active;

    const { data, error } = await supabase
      .from("schedules")
      .upsert(upsertData, { onConflict: "user_id" })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ schedule: data });
  } catch (error) {
    log.error("Error actualizando schedule", error);
    return NextResponse.json(
      { error: "Error al actualizar schedule" },
      { status: 500 }
    );
  }
}
