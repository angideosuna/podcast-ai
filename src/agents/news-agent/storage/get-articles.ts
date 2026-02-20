// Consulta processed_news y devuelve Article[] para el generador de podcasts
// Usa el mismo cliente service_role que el resto del agente

import { getClient } from "./supabase";
import { createLogger } from "@/lib/logger";
import { TOPIC_TO_CATEGORIES } from "@/lib/topics";
import { getCachedArticles, setCachedArticles } from "@/lib/news-cache";
import type { Article } from "@/lib/types";
import type { ProcessedNewsItem } from "../utils/types";

const log = createLogger("agent:get-articles");

/**
 * Obtiene artículos del News Agent (processed_news en Supabase).
 * Mapea los topics del usuario a las categorías del agente,
 * filtra por relevancia y devuelve Article[] listo para generateScript.
 * Usa caché en memoria con TTL de 1 hora.
 */
export async function fetchFromAgent(
  topics: string[],
  count: number = 10
): Promise<Article[]> {
  // Resolver categorías únicas a partir de los topics del usuario
  const categories = [
    ...new Set(topics.flatMap((t) => TOPIC_TO_CATEGORIES[t] ?? [])),
  ];

  if (categories.length === 0) {
    log.warn(`Sin mapeo de categorías para topics: ${topics.join(", ")}`);
    return [];
  }

  // Build cache key: sorted categories + current hour
  const cacheKey = `${categories.sort().join(",")}-${new Date().toISOString().slice(0, 13)}`;
  const cached = getCachedArticles(cacheKey);
  if (cached) {
    log.info(`Cache hit (${cacheKey}): ${cached.length} artículos`);
    return cached.slice(0, count);
  }

  log.info(
    `Cache miss — buscando en processed_news — categorías: ${categories.join(", ")} (topics: ${topics.join(", ")})`
  );

  const db = getClient();

  // Solo noticias de las ultimas 48h para evitar servir contenido obsoleto
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("processed_news")
    .select("*")
    .in("category", categories)
    .gte("processed_at", since)
    .order("relevance_score", { ascending: false })
    .limit(count);

  if (error) {
    log.error("Error consultando processed_news", error.message);
    return [];
  }

  const items = data as ProcessedNewsItem[];

  log.info(`processed_news devolvió ${items.length} artículos`);

  // Convertir ProcessedNewsItem → Article (el tipo que espera generateScript)
  const articles = items.map((item) => ({
    title: item.title,
    description: item.summary,
    source: item.source_name,
    url: item.url,
    publishedAt: item.published_at ?? new Date().toISOString(),
  }));

  // Store in cache
  setCachedArticles(cacheKey, articles);

  return articles;
}
