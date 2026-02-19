// Storage layer — conexión con Supabase para el News Agent
// Usa service_role key para bypasear RLS (el agente es un proceso de servidor)

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { createLogger } from "@/lib/logger";
import type { RawNewsItem, ProcessedNewsItem, SourceHealth } from "../utils/types";

const log = createLogger("agent:storage");

let client: SupabaseClient | null = null;

/** Obtiene el cliente de Supabase con service_role key */
export function getClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local"
    );
  }

  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  log.info("Cliente Supabase inicializado (service_role)");
  return client;
}

// ============================================
// raw_news
// ============================================

/** Guarda noticias raw en batch, ignora duplicados por URL */
export async function saveRawNews(items: RawNewsItem[]): Promise<number> {
  if (items.length === 0) return 0;

  const db = getClient();

  const rows = items.map((item) => ({
    source_id: item.source_id,
    source_name: item.source_name,
    source_type: item.source_type,
    title: item.title,
    description: item.description,
    content: item.content,
    url: item.url,
    image_url: item.image_url,
    author: item.author,
    language: item.language,
    category: item.category,
    published_at: item.published_at,
  }));

  const { data, error } = await db
    .from("raw_news")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: true })
    .select("id");

  if (error) {
    log.error("Error guardando noticias raw en batch", error.message);
    return 0;
  }

  const saved = data?.length ?? 0;
  log.info(`Guardadas ${saved}/${items.length} noticias raw`);
  return saved;
}

/** Obtiene noticias raw sin procesar */
export async function getRawNewsToProcess(
  limit: number = 20
): Promise<RawNewsItem[]> {
  const db = getClient();

  const { data, error } = await db
    .from("raw_news")
    .select("*")
    .eq("processed", false)
    .order("fetched_at", { ascending: false })
    .limit(limit);

  if (error) {
    log.error("Error obteniendo raw news", error.message);
    return [];
  }

  return data as RawNewsItem[];
}

/** Marca noticias como procesadas */
export async function markAsProcessed(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  const db = getClient();

  const { error } = await db
    .from("raw_news")
    .update({ processed: true })
    .in("id", ids);

  if (error) {
    log.error("Error marcando como procesadas", error.message);
  }
}

// ============================================
// processed_news
// ============================================

/** Guarda noticias procesadas en batch */
export async function saveProcessedNews(
  items: ProcessedNewsItem[]
): Promise<number> {
  if (items.length === 0) return 0;

  const db = getClient();

  const { data, error } = await db
    .from("processed_news")
    .insert(
      items.map((item) => ({
        raw_news_id: item.raw_news_id,
        title: item.title,
        summary: item.summary,
        category: item.category,
        relevance_score: item.relevance_score,
        language: item.language,
        keywords: item.keywords,
        url: item.url,
        source_name: item.source_name,
        published_at: item.published_at,
      }))
    )
    .select("id");

  if (error) {
    log.error("Error guardando processed news", error.message);
    return 0;
  }

  return data?.length ?? 0;
}

/** Obtiene las noticias más relevantes. Si se pasa fecha filtra por ese día, si no devuelve las más recientes. */
export async function getTopNews(
  limit: number = 10,
  date?: string
): Promise<ProcessedNewsItem[]> {
  const db = getClient();

  let query = db
    .from("processed_news")
    .select("*");

  if (date) {
    query = query
      .gte("published_at", `${date}T00:00:00`)
      .lte("published_at", `${date}T23:59:59`);
  }

  const { data, error } = await query
    .order("relevance_score", { ascending: false })
    .limit(limit);

  if (error) {
    log.error("Error obteniendo top news", error.message);
    return [];
  }

  return data as ProcessedNewsItem[];
}

// ============================================
// sources_health
// ============================================

/** Actualiza el estado de salud de una fuente (upsert) */
export async function updateSourceHealth(
  sourceId: string,
  sourceName: string,
  sourceType: string,
  success: boolean,
  articleCount: number,
  errorMsg?: string
): Promise<void> {
  const db = getClient();
  const now = new Date().toISOString();

  const update: Partial<SourceHealth> & Record<string, unknown> = {
    source_id: sourceId,
    source_name: sourceName,
    source_type: sourceType,
    last_fetch_at: now,
    updated_at: now,
  };

  if (success) {
    update.last_success_at = now;
    update.consecutive_failures = 0;
    update.last_error = null;
    // total_articles_fetched se incrementa con RPC o manualmente
  } else {
    update.last_error = errorMsg ?? "Unknown error";
    // Incrementar consecutive_failures requiere leer el valor actual
  }

  // Upsert por source_id
  const { error } = await db
    .from("sources_health")
    .upsert(update, { onConflict: "source_id" });

  if (error) {
    log.warn(`Error actualizando health de ${sourceId}`, error.message);
    return;
  }

  // Si fue éxito, incrementar total_articles_fetched
  if (success && articleCount > 0) {
    await db.rpc("increment_articles_fetched", {
      p_source_id: sourceId,
      p_count: articleCount,
    });
  }

  // Si fue fallo, incrementar consecutive_failures
  if (!success) {
    await db.rpc("increment_consecutive_failures", {
      p_source_id: sourceId,
    });
  }
}

/** Obtiene el estado de todas las fuentes */
export async function getAllSourcesHealth(): Promise<SourceHealth[]> {
  const db = getClient();

  const { data, error } = await db
    .from("sources_health")
    .select("*")
    .order("source_id");

  if (error) {
    log.error("Error obteniendo sources health", error.message);
    return [];
  }

  return data as SourceHealth[];
}
