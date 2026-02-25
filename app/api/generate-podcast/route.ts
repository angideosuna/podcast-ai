// API Route: Orquesta la generación del podcast
// POST /api/generate-podcast

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { ALL_SUBTOPIC_IDS } from "@/lib/topics";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";
import { generatePodcast } from "@/lib/generate-podcast";

export const maxDuration = 300; // 5 min — Claude tarda 40-120s según la duración del guion

const log = createLogger("api/generate-podcast");

interface GenerateRequest {
  topics: string[];
  duration: number;
  tone: string;
  adjustments?: string;
}

export async function POST(request: Request) {
  // Rate limiting: 10 peticiones por IP cada 60 segundos
  const ip = getClientIP(request);
  const { allowed, remaining } = await checkRateLimit(`generate-podcast:${ip}`, {
    maxRequests: 10,
    windowSeconds: 60,
  });

  if (!allowed) {
    return NextResponse.json(
      { error: "Demasiadas peticiones. Espera un momento antes de reintentar." },
      { status: 429, headers: { "Retry-After": "60", "X-RateLimit-Remaining": "0" } }
    );
  }

  try {
    const body: GenerateRequest = await request.json();
    const { topics, duration, tone, adjustments } = body;

    // Validar campos requeridos
    if (!topics?.length || !duration || !tone) {
      return NextResponse.json(
        { error: "Faltan campos requeridos: topics, duration, tone" },
        { status: 400 }
      );
    }

    // Validar tipos y valores
    if (!Array.isArray(topics) || !topics.every((t) => {
      if (typeof t !== "string") return false;
      if (ALL_SUBTOPIC_IDS.has(t)) return true;
      if (t.startsWith("custom:")) {
        const label = t.slice(7).trim();
        return label.length > 0 && label.length <= 50;
      }
      return false;
    })) {
      return NextResponse.json(
        { error: "topics debe ser un array de IDs de temas válidos" },
        { status: 400 }
      );
    }

    if (![15, 30, 60].includes(duration)) {
      return NextResponse.json(
        { error: "duration debe ser 15, 30 o 60" },
        { status: 400 }
      );
    }

    if (!["casual", "profesional", "deep-dive"].includes(tone)) {
      return NextResponse.json(
        { error: "tone debe ser 'casual', 'profesional' o 'deep-dive'" },
        { status: 400 }
      );
    }

    if (adjustments !== undefined && (typeof adjustments !== "string" || adjustments.length > 500)) {
      return NextResponse.json(
        { error: "adjustments debe ser un string de máximo 500 caracteres" },
        { status: 400 }
      );
    }

    // Validar que las API keys estan configuradas
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY no está configurada en el servidor" },
        { status: 500 }
      );
    }

    // Obtener usuario autenticado
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

    const result = await generatePodcast({
      topics,
      duration,
      tone,
      adjustments,
      userId: user.id,
      supabase,
    });

    return NextResponse.json(result, {
      headers: { "X-RateLimit-Remaining": String(remaining) },
    });
  } catch (error) {
    log.error("Error generando podcast", error);

    const message =
      error instanceof Error ? error.message : "Error desconocido";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
