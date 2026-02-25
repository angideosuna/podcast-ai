// Deduplicador v2 — elimina noticias duplicadas dentro de un batch
// y contra las últimas 24h de processed_news (cross-temporal)
//
// Algoritmo:
// 1. Dedup interna: >70% word overlap en título O >60% en descripción = duplicado
// 2. Al encontrar duplicados, se queda con el artículo de descripción más larga
// 3. Dedup cross-temporal: compara contra processed_news de las últimas 24h (>70% título)

import { createLogger } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawNewsItem } from "../utils/types";

const log = createLogger("agent:dedup");

// ── Stopwords ──────────────────────────────────────────────────
const STOPWORDS = new Set([
  // Español
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al",
  "en", "con", "por", "para", "sin", "sobre", "entre", "desde", "hasta",
  "que", "se", "no", "es", "su", "sus", "mas", "pero", "como", "ya",
  "hay", "este", "esta", "estos", "estas", "ese", "esa", "esos", "esas",
  "ser", "ha", "han", "fue", "son", "era", "muy", "tambien", "asi", "todo",
  // Inglés
  "the", "a", "an", "in", "of", "for", "to", "and", "is", "on", "at",
  "by", "it", "or", "as", "be", "was", "are", "has", "had", "not", "but",
  "from", "with", "this", "that", "its", "will", "can", "all", "been",
  "have", "their", "more", "when", "who", "than", "into", "some", "they",
]);

// ── Normalización ──────────────────────────────────────────────

/** Normaliza texto para comparación: minúsculas, sin acentos, sin puntuación, sin stopwords */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s]/g, "")    // quitar puntuación
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrae palabras significativas (sin stopwords, longitud > 2) */
function extractWords(normalized: string): Set<string> {
  return new Set(
    normalized.split(" ").filter((w) => w.length > 2 && !STOPWORDS.has(w))
  );
}

/** Calcula el porcentaje de palabras compartidas entre dos conjuntos */
function wordOverlap(wordsA: Set<string>, wordsB: Set<string>): number {
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared++;
  }

  const minSize = Math.min(wordsA.size, wordsB.size);
  return shared / minSize;
}

// ── Tipos internos ─────────────────────────────────────────────

interface NormalizedItem {
  item: RawNewsItem;
  titleWords: Set<string>;
  descWords: Set<string>;
  descLength: number;
}

// ── Dedup interna del batch ────────────────────────────────────

/** Compara dos items: >70% título O >60% descripción = duplicado */
function isDuplicatePair(a: NormalizedItem, b: NormalizedItem): boolean {
  // Título: >70% overlap
  if (wordOverlap(a.titleWords, b.titleWords) > 0.7) return true;

  // Descripción: >60% overlap (solo si ambos tienen descripción)
  if (a.descWords.size > 0 && b.descWords.size > 0) {
    if (wordOverlap(a.descWords, b.descWords) > 0.6) return true;
  }

  return false;
}

/**
 * Dedup interna: elimina duplicados dentro del batch.
 * Al encontrar duplicados, se queda con el artículo de descripción más larga.
 */
function deduplicateBatch(items: RawNewsItem[]): RawNewsItem[] {
  const normalized: NormalizedItem[] = items.map((item) => {
    const normTitle = normalizeText(item.title);
    const normDesc = normalizeText(item.description || "");
    return {
      item,
      titleWords: extractWords(normTitle),
      descWords: extractWords(normDesc),
      descLength: (item.description || "").length,
    };
  });

  const kept: NormalizedItem[] = [];

  for (const current of normalized) {
    let duplicateIndex = -1;

    for (let i = 0; i < kept.length; i++) {
      if (isDuplicatePair(current, kept[i])) {
        duplicateIndex = i;
        break;
      }
    }

    if (duplicateIndex === -1) {
      // No es duplicado, añadir
      kept.push(current);
    } else {
      // Es duplicado — quedarse con el que tenga descripción más larga
      if (current.descLength > kept[duplicateIndex].descLength) {
        kept[duplicateIndex] = current;
      }
    }
  }

  return kept.map((n) => n.item);
}

// ── Dedup cross-temporal contra processed_news ─────────────────

/**
 * Obtiene títulos de processed_news de las últimas 24h para dedup cross-temporal.
 */
async function getRecentProcessedTitles(
  supabase: SupabaseClient
): Promise<Set<string>[]> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("processed_news")
    .select("title")
    .gt("processed_at", since);

  if (error) {
    log.warn("Error consultando processed_news para dedup cross-temporal", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  log.info(`Cross-temporal: ${data.length} títulos de processed_news (últimas 24h)`);

  return data.map((row: { title: string }) =>
    extractWords(normalizeText(row.title))
  );
}

/**
 * Filtra items que ya existen en processed_news (>70% overlap en título).
 */
function filterAgainstProcessed(
  items: RawNewsItem[],
  processedTitleWords: Set<string>[]
): RawNewsItem[] {
  if (processedTitleWords.length === 0) return items;

  const surviving: RawNewsItem[] = [];

  for (const item of items) {
    const titleWords = extractWords(normalizeText(item.title));
    let alreadyExists = false;

    for (const existingWords of processedTitleWords) {
      if (wordOverlap(titleWords, existingWords) > 0.7) {
        alreadyExists = true;
        break;
      }
    }

    if (!alreadyExists) {
      surviving.push(item);
    }
  }

  return surviving;
}

// ── API pública ────────────────────────────────────────────────

/**
 * Pipeline completo de deduplicación:
 * 1. Dedup interna del batch (título >70% O descripción >60%)
 * 2. Dedup cross-temporal contra processed_news de las últimas 24h
 */
export async function deduplicate(
  items: RawNewsItem[],
  supabase?: SupabaseClient
): Promise<RawNewsItem[]> {
  if (items.length === 0) return [];

  const inputCount = items.length;
  log.info(`Dedup: ${inputCount} artículos entrantes`);

  // Paso 1: Dedup interna del batch
  const afterBatch = deduplicateBatch(items);
  const batchRemoved = inputCount - afterBatch.length;

  if (batchRemoved > 0) {
    log.info(`Dedup interna: ${inputCount} → ${afterBatch.length} (${batchRemoved} duplicados eliminados)`);
  } else {
    log.info(`Dedup interna: ${afterBatch.length} artículos, ningún duplicado`);
  }

  // Paso 2: Dedup cross-temporal contra processed_news
  if (!supabase) {
    log.info(`Dedup completado: ${inputCount} → ${afterBatch.length} (sin cross-temporal, no hay cliente Supabase)`);
    return afterBatch;
  }

  let afterCross = afterBatch;
  try {
    const processedTitleWords = await getRecentProcessedTitles(supabase);
    afterCross = filterAgainstProcessed(afterBatch, processedTitleWords);
    const crossRemoved = afterBatch.length - afterCross.length;

    if (crossRemoved > 0) {
      log.info(`Dedup cross-temporal: ${afterBatch.length} → ${afterCross.length} (${crossRemoved} ya existían en processed_news)`);
    } else {
      log.info(`Dedup cross-temporal: ${afterCross.length} artículos, ninguno ya procesado`);
    }
  } catch (err) {
    log.warn("Error en dedup cross-temporal, continuando sin ella", err);
    afterCross = afterBatch;
  }

  const totalRemoved = inputCount - afterCross.length;
  log.info(`Dedup completado: ${inputCount} → ${afterCross.length} (${totalRemoved} eliminados en total: ${batchRemoved} internos + ${afterBatch.length - afterCross.length} cross-temporal)`);

  return afterCross;
}
