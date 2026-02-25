// Generación de clips trending de 5 minutos

import { createClient } from "@supabase/supabase-js";
import { generateScript } from "@/lib/generate-script";
import { createLogger } from "@/lib/logger";
import type { Article } from "@/lib/types";

const log = createLogger("generate-clip");

interface ClipResult {
  script: string;
  articles: { title: string; source_name: string; url: string }[];
}

export async function generateClip(topic: string): Promise<ClipResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase config missing");
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Buscar artículos relacionados con el topic en las últimas 48h
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  // Escapar caracteres especiales de ILIKE (% y _) para evitar wildcards no deseados
  const safeTopic = topic.replace(/[%_\\]/g, "\\$&");

  const { data: articles, error } = await supabase
    .from("processed_news")
    .select("title, summary, category, url, source_name, published_at, relevance_score, sentiment, impact_scope")
    .or(`title.ilike.%${safeTopic}%,summary.ilike.%${safeTopic}%`)
    .gte("published_at", since)
    .order("relevance_score", { ascending: false })
    .limit(2);

  if (error) {
    log.error(`Error buscando artículos para "${topic}":`, error);
    throw new Error(`Error buscando artículos: ${error.message}`);
  }

  if (!articles || articles.length === 0) {
    throw new Error(`No se encontraron artículos sobre "${topic}" en las últimas 48h`);
  }

  log.info(`Encontrados ${articles.length} artículos para clip "${topic}"`);

  // Mapear a formato Article para generateScript
  const mappedArticles: Article[] = articles.map((a) => ({
    title: a.title,
    description: a.summary,
    source: a.source_name,
    url: a.url,
    publishedAt: a.published_at || new Date().toISOString(),
    sentiment: a.sentiment || undefined,
    impact_scope: a.impact_scope || undefined,
    category: a.category || undefined,
  }));

  const adjustments = `Clip trending de 5 min sobre '${topic}'. Céntrate solo en este tema.`;

  const script = await generateScript(
    mappedArticles,
    5,
    "casual",
    adjustments,
    null,
    null,
    null,
    undefined
  );

  return {
    script,
    articles: articles.map((a) => ({
      title: a.title,
      source_name: a.source_name,
      url: a.url,
    })),
  };
}
