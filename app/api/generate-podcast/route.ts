// API Route: Orquesta la generación del podcast
// POST /api/generate-podcast

import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/newsapi";
import { fetchFromAgent } from "@/src/agents/news-agent/storage/get-articles";
import { generateScript, ARTICLES_BY_DURATION } from "@/lib/generate-script";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";
import { ALL_SUBTOPIC_IDS } from "@/lib/topics";
import { checkRateLimit, getClientIP } from "@/lib/rate-limit";

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
  const { allowed, remaining } = checkRateLimit(`generate-podcast:${ip}`, {
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

    if (![5, 15, 30].includes(duration)) {
      return NextResponse.json(
        { error: "duration debe ser 5, 15 o 30" },
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

    // Paso 1: Buscar noticias — primero del News Agent, fallback a GNews
    const minArticles = ARTICLES_BY_DURATION[duration] || 5;
    let articles = await fetchFromAgent(topics, minArticles + 2);
    let source: "agent" | "gnews" = "agent";

    if (articles.length < minArticles) {
      log.info(
        `Agent devolvió ${articles.length} artículos (mínimo ${minArticles}), intentando fallback a GNews`
      );
      try {
        articles = await fetchNews(topics);
        source = "gnews";
      } catch (gnewsError) {
        // Si GNews también falla y el agente devolvió algo, usar lo que haya
        if (articles.length > 0) {
          log.warn("GNews falló, usando artículos parciales del agente", gnewsError);
          source = "agent";
        } else {
          throw gnewsError;
        }
      }
    }

    log.info(`Usando ${articles.length} artículos de ${source}`);

    // Paso 2: Obtener perfil del usuario si está autenticado
    let profile: Record<string, string | null> | null = null;
    let userId: string | null = null;
    const supabase = await createClient();
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        userId = user.id;
        const { data: profileData } = await supabase
          .from("profiles")
          .select("nombre, rol, sector, edad, ciudad, nivel_conocimiento, objetivo_podcast, horario_escucha")
          .eq("id", user.id)
          .single();

        if (profileData) {
          profile = profileData as Record<string, string | null>;
        }
      }
    } catch (profileError) {
      log.warn("No se pudo cargar el perfil del usuario", profileError);
    }

    // Paso 3: Generar el guion con Claude
    const script = await generateScript(articles, duration, tone, adjustments, profile);

    const selectedArticles = articles.slice(0, minArticles);

    // Paso 4: Guardar episodio en Supabase (si el usuario está autenticado)
    let episodeId: string | null = null;
    if (userId) {
      try {
        const { data: episode } = await supabase
          .from("episodes")
          .insert({
            user_id: userId,
            title: `Podcast del ${new Date().toLocaleDateString("es-ES")}`,
            script,
            duration,
            tone,
            topics,
            articles: selectedArticles,
            adjustments: adjustments || null,
          })
          .select("id")
          .single();

        episodeId = episode?.id || null;
      } catch (saveError) {
        // No bloquear si falla el guardado (el podcast ya se generó)
        log.warn("No se pudo guardar el episodio en Supabase", saveError);
      }
    }

    return NextResponse.json({
      script,
      articles: selectedArticles,
      episodeId,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error("Error generando podcast", error);

    const message =
      error instanceof Error ? error.message : "Error desconocido";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
