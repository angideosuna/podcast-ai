// API Route: Orquesta la generación del podcast
// POST /api/generate-podcast

import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/newsapi";
import { generateScript } from "@/lib/generate-script";
import { createClient } from "@/lib/supabase/server";

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

    // Validar que las API keys están configuradas
    if (!process.env.NEWSAPI_KEY) {
      return NextResponse.json(
        { error: "NEWSAPI_KEY no está configurada en el servidor" },
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

    // Paso 2: Generar el guion con Claude
    const script = await generateScript(articles, duration, tone, adjustments);

    const selectedArticles = articles.slice(
      0,
      duration === 5 ? 3 : duration === 15 ? 5 : 8
    );

    // Paso 3: Guardar episodio en Supabase (si el usuario está autenticado)
    let episodeId: string | null = null;
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: episode } = await supabase
          .from("episodes")
          .insert({
            user_id: user.id,
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
      }
    } catch {
      // No bloquear si falla el guardado (el podcast ya se generó)
      console.warn("No se pudo guardar el episodio en Supabase");
    }

    return NextResponse.json({
      script,
      articles: selectedArticles,
      episodeId,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generando podcast:", error);

    const message =
      error instanceof Error ? error.message : "Error desconocido";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
