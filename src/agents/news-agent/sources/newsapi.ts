// Fuente NewsAPI — newsapi.org
// Plan gratis: 100 req/día, max 100 resultados por request

import { createLogger } from "@/lib/logger";
import type { FetchResult, APISourceConfig, RawNewsItem } from "../utils/types";

const log = createLogger("agent:newsapi");

const BASE_URL = "https://newsapi.org/v2";

interface NewsAPIArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

interface NewsAPIResponse {
  status: string;
  totalResults: number;
  articles: NewsAPIArticle[];
  code?: string;
  message?: string;
}

/** Fetch top headlines de una categoría */
async function fetchCategory(
  category: string,
  apiKey: string
): Promise<NewsAPIArticle[]> {
  // top-headlines con country=us para inglés
  const url = `${BASE_URL}/top-headlines?category=${category}&language=en&pageSize=20&apiKey=${apiKey}`;

  const res = await fetch(url);
  const data = (await res.json()) as NewsAPIResponse;

  if (data.status !== "ok") {
    throw new Error(`NewsAPI error: ${data.code} — ${data.message}`);
  }

  return data.articles;
}

/** Fetch top headlines en español */
async function fetchSpanishHeadlines(
  apiKey: string
): Promise<NewsAPIArticle[]> {
  const url = `${BASE_URL}/top-headlines?language=es&pageSize=30&apiKey=${apiKey}`;

  const res = await fetch(url);
  const data = (await res.json()) as NewsAPIResponse;

  if (data.status !== "ok") {
    throw new Error(`NewsAPI error (es): ${data.code} — ${data.message}`);
  }

  return data.articles;
}

/** Convierte un artículo de NewsAPI a RawNewsItem */
function toRawNewsItem(
  article: NewsAPIArticle,
  category: string,
  language: string
): RawNewsItem | null {
  // NewsAPI a veces devuelve artículos "[Removed]"
  if (!article.title || article.title === "[Removed]") return null;
  if (!article.url || article.url === "https://removed.com") return null;

  return {
    source_id: `newsapi-${category}`,
    source_name: `NewsAPI: ${article.source.name}`,
    source_type: "newsapi",
    title: article.title.trim(),
    description: article.description?.trim() || null,
    content: article.content?.trim() || null,
    url: article.url.trim(),
    image_url: article.urlToImage || null,
    author: article.author || null,
    language,
    category,
    published_at: article.publishedAt || null,
  };
}

/** Fetch completo de NewsAPI: top-headlines por categoría + español */
export async function fetchNewsAPI(
  source: APISourceConfig
): Promise<FetchResult> {
  const startTime = Date.now();
  const apiKey = process.env.NEWSAPI_KEY;

  if (!apiKey) {
    return {
      source_id: source.id,
      source_name: source.name,
      items: [],
      success: false,
      error: "Falta NEWSAPI_KEY en .env.local (https://newsapi.org)",
      duration_ms: 0,
    };
  }

  try {
    log.info(`Fetching NewsAPI: ${source.categories.length} categorías + español`);
    const allItems: RawNewsItem[] = [];
    const seen = new Set<string>(); // dedup por URL dentro del mismo fetch

    // Fetch por categoría en inglés (en secuencial para no agotar rate limit)
    for (const category of source.categories) {
      try {
        const articles = await fetchCategory(category, apiKey);
        let count = 0;

        for (const article of articles) {
          const item = toRawNewsItem(article, category, "en");
          if (item && !seen.has(item.url)) {
            seen.add(item.url);
            allItems.push(item);
            count++;
          }
        }

        log.info(`  [${category}] ${count} noticias (${articles.length} raw)`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error";
        log.warn(`  [${category}] Error: ${msg}`);
      }
    }

    // Fetch headlines en español
    try {
      const esArticles = await fetchSpanishHeadlines(apiKey);
      let esCount = 0;

      for (const article of esArticles) {
        const item = toRawNewsItem(article, "general", "es");
        if (item && !seen.has(item.url)) {
          seen.add(item.url);
          allItems.push(item);
          esCount++;
        }
      }

      log.info(`  [español] ${esCount} noticias (${esArticles.length} raw)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      log.warn(`  [español] Error: ${msg}`);
    }

    const duration = Date.now() - startTime;
    log.info(`[NewsAPI] Total: ${allItems.length} noticias únicas en ${duration}ms`);

    return {
      source_id: source.id,
      source_name: source.name,
      items: allItems,
      success: true,
      duration_ms: duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : "Error desconocido";
    log.error(`[NewsAPI] Error general: ${msg}`);

    return {
      source_id: source.id,
      source_name: source.name,
      items: [],
      success: false,
      error: msg,
      duration_ms: duration,
    };
  }
}
