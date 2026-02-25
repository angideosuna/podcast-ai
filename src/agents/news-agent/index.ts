// News Agent — Orquestador principal
// Coordina fuentes, procesamiento y almacenamiento

import { createLogger } from "@/lib/logger";
import { fetchAllSources, getSourcesConfig } from "./sources";
import { processRawNews } from "./processors";
import * as storage from "./storage/supabase";
import type {
  FetchResult,
  ProcessedNewsItem,
  SourceHealth,
  AgentConfig,
} from "./utils/types";
import agentConfig from "./config/agent-config.json";

const log = createLogger("agent:news");
const config = agentConfig as AgentConfig;

export class NewsAgent {
  // ============================================
  // Fetch — recoger noticias de todas las fuentes
  // ============================================

  async fetchAll(): Promise<FetchResult[]> {
    log.info("=== INICIO: Fetch de todas las fuentes ===");
    const startTime = Date.now();

    const results = await fetchAllSources();

    // Guardar noticias en raw_news
    let totalSaved = 0;
    for (const result of results) {
      if (result.success && result.items.length > 0) {
        const saved = await storage.saveRawNews(result.items);
        totalSaved += saved;
      }

      // Actualizar health de la fuente
      await storage.updateSourceHealth(
        result.source_id,
        result.source_name,
        result.source_id.includes("newsapi") ? "api" : "rss",
        result.success,
        result.items.length,
        result.error
      );
    }

    const duration = Date.now() - startTime;
    log.info(
      `=== FIN: Fetch completado en ${duration}ms — ${totalSaved} noticias nuevas guardadas ===`
    );

    return results;
  }

  // ============================================
  // Process — analizar noticias pendientes con IA
  // ============================================

  async processAll(): Promise<ProcessedNewsItem[]> {
    log.info("=== INICIO: Procesamiento de noticias ===");
    const startTime = Date.now();

    // Obtener noticias sin procesar
    const rawItems = await storage.getRawNewsToProcess(config.processing.batch_size);
    log.info(`Noticias pendientes de procesar: ${rawItems.length}`);

    if (rawItems.length === 0) {
      log.info("No hay noticias pendientes");
      return [];
    }

    // Procesar con IA
    const processed = await processRawNews(rawItems);

    // Guardar resultados
    if (processed.length > 0) {
      const saved = await storage.saveProcessedNews(processed);
      log.info(`Guardadas ${saved} noticias procesadas`);

      // Marcar raw como procesadas
      const rawIds = rawItems.map((item) => item.id!).filter(Boolean);
      await storage.markAsProcessed(rawIds);
    }

    const duration = Date.now() - startTime;
    log.info(
      `=== FIN: Procesamiento completado en ${duration}ms — ${processed.length} noticias procesadas ===`
    );

    return processed;
  }

  // ============================================
  // Top News — obtener las noticias más relevantes
  // ============================================

  async getTopNews(
    limit: number = 10,
    date?: string
  ): Promise<ProcessedNewsItem[]> {
    log.info(`Obteniendo top ${limit} noticias${date ? ` del ${date}` : " de hoy"}`);
    return storage.getTopNews(limit, date);
  }

  // ============================================
  // Health — estado de las fuentes
  // ============================================

  async getSourcesHealth(): Promise<SourceHealth[]> {
    return storage.getAllSourcesHealth();
  }

  // ============================================
  // Info — configuración actual
  // ============================================

  getConfig(): AgentConfig {
    return config;
  }

  getSourcesList(): { rss: number; apis: number; total: number } {
    const sources = getSourcesConfig();
    const enabled = sources.sources.filter((s) => s.enabled);
    const rss = enabled.filter((s) => s.type === "rss").length;
    const apis = enabled.filter((s) => s.type === "newsapi").length;
    return { rss, apis, total: rss + apis };
  }
}
