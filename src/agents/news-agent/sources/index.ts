// Registro de fuentes del News Agent
// Cada fuente implementa la interfaz FetchResult

import { createLogger } from "@/lib/logger";
import { fetchAllRSS } from "./rss";
import { fetchNewsAPI } from "./newsapi";
import type { FetchResult, SourcesConfig } from "../utils/types";
import sourcesConfig from "../config/sources.json";

const log = createLogger("agent:sources");
const config = sourcesConfig as SourcesConfig;

/** Ejecuta todas las fuentes habilitadas y devuelve los resultados */
export async function fetchAllSources(): Promise<FetchResult[]> {
  const results: FetchResult[] = [];

  // --- RSS Feeds (en paralelo) ---
  const rssResults = await fetchAllRSS(config.rss);
  results.push(...rssResults);

  // --- APIs ---
  const enabledAPIs = config.apis.filter((s) => s.enabled);
  log.info(`Fuentes API habilitadas: ${enabledAPIs.length}`);

  for (const source of enabledAPIs) {
    try {
      if (source.type === "newsapi") {
        const result = await fetchNewsAPI(source);
        results.push(result);
      } else {
        log.warn(`[API] Tipo desconocido: ${source.type}`);
      }
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
