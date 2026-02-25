// Core podcast generation logic — shared between manual route and cron

import { fetchNews } from "@/lib/newsapi";
import { fetchFromAgent } from "@/src/agents/news-agent/storage/get-articles";
import { generateScript, ARTICLES_BY_DURATION } from "@/lib/generate-script";
import { getUserInsights } from "@/lib/user-insights";
import { createLogger } from "@/lib/logger";
import type { Article } from "@/lib/types";
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
  articles: Article[];
  episodeId: string | null;
  generatedAt: string;
}

export async function generatePodcast(params: GeneratePodcastParams): Promise<GeneratePodcastResult> {
  const { topics, duration, tone, adjustments, userId, supabase } = params;

  // Paso 1: Buscar noticias — primero del News Agent (selección inteligente), fallback a GNews
  const minArticles = ARTICLES_BY_DURATION[duration] || 5;
  let articles = await fetchFromAgent(topics, duration);
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

  // Paso 2: Obtener perfil, insights y trending en paralelo (3 queries independientes)
  const todayStr = new Date().toISOString().split("T")[0];

  const [profileResult, insightsResult, trendingResult, prevEpisodesResult] = await Promise.allSettled([
    supabase
      .from("profiles")
      .select("nombre, rol, sector, edad, ciudad, nivel_conocimiento, objetivo_podcast, horario_escucha")
      .eq("id", userId)
      .single(),
    getUserInsights(userId, supabase),
    supabase
      .from("trending_topics")
      .select("topic, score, article_count, category")
      .eq("date", todayStr)
      .order("score", { ascending: false })
      .limit(3),
    supabase
      .from("episodes")
      .select("title, topics")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  let profile: Record<string, string | null> | null = null;
  if (profileResult.status === "fulfilled" && profileResult.value.data) {
    profile = profileResult.value.data as Record<string, string | null>;
  } else if (profileResult.status === "rejected") {
    log.warn("No se pudo cargar el perfil del usuario", profileResult.reason);
  }

  let insights: string | null = null;
  if (insightsResult.status === "fulfilled") {
    insights = insightsResult.value;
  } else {
    log.warn("No se pudieron obtener insights del usuario", insightsResult.reason);
  }

  let trending: { topic: string; score: number; article_count: number; category: string | null }[] | null = null;
  if (trendingResult.status === "fulfilled" && trendingResult.value.data?.length) {
    trending = trendingResult.value.data;
    log.info(`Trending topics: ${trending.map((t) => t.topic).join(", ")}`);
  } else if (trendingResult.status === "rejected") {
    log.warn("No se pudieron obtener trending topics", trendingResult.reason);
  }

  let previousEpisodes: { title: string; topics: string[] }[] | null = null;
  if (prevEpisodesResult.status === "fulfilled" && prevEpisodesResult.value.data?.length) {
    previousEpisodes = prevEpisodesResult.value.data;
    log.info(`Previous episodes: ${previousEpisodes.map((e) => e.title).join(", ")}`);
  }

  // Paso 4: Generar el guion con Claude
  const script = await generateScript(articles, duration, tone, adjustments, profile, insights, trending, topics, previousEpisodes);

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
