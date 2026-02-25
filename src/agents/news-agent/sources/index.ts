// Registro de fuentes del News Agent
// Cada fuente implementa la interfaz FetchResult

import { createLogger } from "@/lib/logger";
import { fetchAllRSS } from "./rss";
import { fetchNewsAPI } from "./newsapi";
import type { FetchResult, SourcesConfig, RSSSourceConfig, APISourceConfig } from "../utils/types";
import sourcesConfig from "../config/sources.json";

const log = createLogger("agent:sources");
const config = sourcesConfig as unknown as SourcesConfig;

/** Ejecuta todas las fuentes habilitadas y devuelve los resultados */
export async function fetchAllSources(): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  // Separar fuentes por tipo
  const rssSources = config.sources.filter((s): s is RSSSourceConfig => s.type === "rss");
  const apiSources = config.sources.filter((s): s is APISourceConfig => s.type === "newsapi");

  // --- RSS Feeds (en paralelo) ---
  const rssResults = await fetchAllRSS(rssSources);
  results.push(...rssResults);

  // --- APIs ---
  const enabledAPIs = apiSources.filter((s) => s.enabled);
  log.info(`Fuentes API habilitadas: ${enabledAPIs.length}`);

  for (const source of enabledAPIs) {
    try {
      const result = await fetchNewsAPI(source);
      results.push(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      log.error(`[API] Error en ${source.name}: ${msg}`);
      results.push({
        source_id: source.id,
        source_name: source.name,
        items: [],
        success: false,
        error: msg,
        duration_ms: 0,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
  log.info(
    `Fetch completado: ${successCount}/${results.length} fuentes OK, ${totalItems} noticias`
  );

  return results;
}

/** Devuelve la lista de fuentes configuradas */
export function getSourcesConfig(): SourcesConfig {
  return config;
}
