// Deduplicador — elimina noticias duplicadas dentro de un batch
// Usa normalización de títulos para detectar la misma noticia de distintas fuentes

import { createLogger } from "@/lib/logger";
import type { RawNewsItem } from "../utils/types";

const log = createLogger("agent:dedup");

/** Normaliza un título para comparación: minúsculas, sin puntuación, sin espacios extra */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .replace(/[^a-z0-9\s]/g, "") // quitar puntuación
    .replace(/\s+/g, " ")
    .trim();
}

/** Calcula el porcentaje de palabras compartidas entre dos títulos */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(b.split(" ").filter((w) => w.length > 2));

  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let shared = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) shared++;
  }

  const minSize = Math.min(wordsA.size, wordsB.size);
  return shared / minSize;
}

/** Elimina duplicados por título similar (>70% overlap de palabras) */
export function deduplicate(items: RawNewsItem[]): RawNewsItem[] {
  const unique: RawNewsItem[] = [];
  const normalizedTitles: string[] = [];

  for (const item of items) {
    const normalized = normalizeTitle(item.title);

    // Buscar si ya hay un título similar
    let isDuplicate = false;
    for (const existing of normalizedTitles) {
      if (normalized === existing || wordOverlap(normalized, existing) > 0.7) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      unique.push(item);
      normalizedTitles.push(normalized);
    }
  }

  const removed = items.length - unique.length;
  if (removed > 0) {
    log.info(`Dedup: ${items.length} → ${unique.length} (${removed} duplicados eliminados)`);
  } else {
    log.info(`Dedup: ${items.length} noticias, ningún duplicado encontrado`);
  }

  return unique;
}
