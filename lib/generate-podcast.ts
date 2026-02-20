// Core podcast generation logic — shared between manual route and cron

import { fetchNews } from "@/lib/newsapi";
import { fetchFromAgent } from "@/src/agents/news-agent/storage/get-articles";
import { generateScript, ARTICLES_BY_DURATION } from "@/lib/generate-script";
import { getUserInsights } from "@/lib/user-insights";
import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const log = createLogger("generate-podcast");

export interface GeneratePodcastParams {
  topics: string[];
  duration: number;
  tone: string;
  adjustments?: string;
  userId: string;
  supabase: SupabaseClient;
}

export interface GeneratePodcastResult {
  script: string;
  articles: { title: string; description: string; source: string; url: string; publishedAt: string }[];
  episodeId: string | null;
  generatedAt: string;
}

export async function generatePodcast(params: GeneratePodcastParams): Promise<GeneratePodcastResult> {
  const { topics, duration, tone, adjustments, userId, supabase } = params;

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
      if (articles.length > 0) {
        log.warn("GNews falló, usando artículos parciales del agente", gnewsError);
        source = "agent";
      } else {
        throw gnewsError;
      }
    }
  }

  log.info(`Usando ${articles.length} artículos de ${source}`);

  // Paso 2: Obtener perfil del usuario
  let profile: Record<string, string | null> | null = null;
  try {
    const { data: profileData } = await supabase
      .from("profiles")
      .select("nombre, rol, sector, edad, ciudad, nivel_conocimiento, objetivo_podcast, horario_escucha")
      .eq("id", userId)
      .single();

    if (profileData) {
      profile = profileData as Record<string, string | null>;
    }
  } catch (profileError) {
    log.warn("No se pudo cargar el perfil del usuario", profileError);
  }

  // Paso 3: Obtener insights del usuario (historial de feedback)
  let insights: string | null = null;
  try {
    insights = await getUserInsights(userId, supabase);
  } catch (insightsError) {
    log.warn("No se pudieron obtener insights del usuario", insightsError);
  }

  // Paso 4: Generar el guion con Claude
  const script = await generateScript(articles, duration, tone, adjustments, profile, insights);

  const selectedArticles = articles.slice(0, minArticles);

  // Paso 5: Guardar episodio en Supabase
  let episodeId: string | null = null;
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
    log.warn("No se pudo guardar el episodio en Supabase", saveError);
  }

  return {
    script,
    articles: selectedArticles,
    episodeId,
    generatedAt: new Date().toISOString(),
  };
}
