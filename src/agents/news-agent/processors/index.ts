// Registro de procesadores del News Agent
// Pipeline: raw_news → dedup → clasificación IA → processed_news

import { createLogger } from "@/lib/logger";
import { deduplicate } from "./deduplicator";
import { classifyWithAI } from "./classifier";
import { updateTrendingTopics } from "./trending";
import type { RawNewsItem, ProcessedNewsItem } from "../utils/types";

const log = createLogger("agent:processors");

/** Procesa un batch de noticias raw: dedup + clasificación IA + trending */
export async function processRawNews(
  items: RawNewsItem[]
): Promise<ProcessedNewsItem[]> {
  if (items.length === 0) {
    log.info("No hay noticias pendientes de procesar");
    return [];
  }

  log.info(`Pipeline: ${items.length} noticias raw entrantes`);

  // Paso 1: Deduplicar por título similar
  const unique = deduplicate(items);

  // Paso 2: Clasificar con IA
  const classified = await classifyWithAI(unique);

  // Paso 3: Actualizar trending topics
  try {
    await updateTrendingTopics();
  } catch (err) {
    log.warn("Error actualizando trending topics", err);
  }

  log.info(`Pipeline completado: ${items.length} raw → ${unique.length} únicas → ${classified.length} clasificadas`);
  return classified;
}
