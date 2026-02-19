// API Route: Orquesta la generación del podcast
// POST /api/generate-podcast

import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/newsapi";
import { generateScript } from "@/lib/generate-script";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/generate-podcast");

interface GenerateRequest {
  topics: string[];
  duration: number;
  tone: string;
  adjustments?: string;
}

export async function POST(request: Request) {
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

    // Validar que las API keys estan configuradas
    if (!process.env.GNEWS_API_KEY) {
      return NextResponse.json(
        { error: "GNEWS_API_KEY no esta configurada en el servidor" },
        { status: 500 }
      );
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY no está configurada en el servidor" },
        { status: 500 }
      );
    }

    // Paso 1: Buscar noticias reales del día
    const articles = await fetchNews(topics);

    // Paso 2: Obtener perfil del usuario si está autenticado
    let profile: Record<string, string | null> | null = null;
    let userId: string | null = null;
    try {
      const supabase = await createClient();
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
    } catch {
      // Silencioso: el perfil es opcional para la generación
    }

    // Paso 3: Generar el guion con Claude
    const script = await generateScript(articles, duration, tone, adjustments, profile);

    const selectedArticles = articles.slice(
      0,
      duration === 5 ? 3 : duration === 15 ? 5 : 8
    );

    // Paso 4: Guardar episodio en Supabase (si el usuario está autenticado)
    let episodeId: string | null = null;
    if (userId) {
      try {
        const supabase = await createClient();
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
