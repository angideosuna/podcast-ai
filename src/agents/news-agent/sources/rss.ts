// Fuente RSS — Parser genérico que funciona con cualquier feed RSS/Atom

import Parser from "rss-parser";
import { createLogger } from "@/lib/logger";
import type { FetchResult, RSSSourceConfig, RawNewsItem } from "../utils/types";

const log = createLogger("agent:rss");

const parser = new Parser({
  timeout: 10000,
  headers: {
    "User-Agent": "PodcastAI-NewsAgent/1.0",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
});

/** Fetch de un feed RSS individual */
export async function fetchRSS(source: RSSSourceConfig): Promise<FetchResult> {
  const startTime = Date.now();

  try {
    log.info(`Fetching RSS: ${source.name} (${source.url})`);

    const feed = await parser.parseURL(source.url);
    const items: RawNewsItem[] = [];

    for (const entry of feed.items) {
      // Saltar entradas sin título o link
      if (!entry.title || !entry.link) continue;

      items.push({
        source_id: source.id,
        source_name: source.name,
        source_type: "rss",
        title: entry.title.trim(),
        description: entry.contentSnippet?.trim() || entry.content?.trim() || null,
        content: entry.content?.trim() || null,
        url: entry.link.trim(),
        image_url: extractImage(entry),
        author: entry.creator || entry.author || null,
        language: source.language,
        category: source.category,
        published_at: entry.isoDate || entry.pubDate || null,
      });
    }

    const duration = Date.now() - startTime;
    log.info(`[RSS] ${source.name}: ${items.length} noticias en ${duration}ms`);

    return {
      source_id: source.id,
      source_name: source.name,
      items,
      success: true,
      duration_ms: duration,
    };
  } catch (err) {
    const duration = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : "Error desconocido";
    log.error(`[RSS] Error en ${source.name}: ${msg}`);

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

/** Fetch de múltiples feeds RSS en paralelo */
export async function fetchAllRSS(
  sources: RSSSourceConfig[]
): Promise<FetchResult[]> {
  const enabled = sources.filter((s) => s.enabled);
  log.info(`Lanzando ${enabled.length} feeds RSS en paralelo...`);

  const results = await Promise.allSettled(
    enabled.map((source) => fetchRSS(source))
  );

  return results.map((result, i) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    // Promise rechazada (no debería pasar porque fetchRSS ya tiene try/catch)
    return {
      source_id: enabled[i].id,
      source_name: enabled[i].name,
      items: [],
      success: false,
      error: result.reason?.message || "Promise rejected",
      duration_ms: 0,
    };
  });
}

/** Intenta extraer URL de imagen del entry RSS */
function extractImage(entry: Record<string, unknown>): string | null {
  // Algunos feeds usan media:content o enclosure
  const media = entry["media:content"] as
    | { $?: { url?: string } }
    | undefined;
  if (media?.$?.url) return media.$.url;

  const enclosure = entry.enclosure as
    | { url?: string; type?: string }
    | undefined;
  if (enclosure?.url && enclosure.type?.startsWith("image")) {
    return enclosure.url;
  }

  return null;
}
