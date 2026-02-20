// Core logic for cleanup — used by both CLI and API route

import { getClient } from "../storage/supabase";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent:cleanup");

export interface CleanupResult {
  success: boolean;
  cutoffDate: string;
  deletedProcessed: number;
  deletedRawProcessed: number;
  deletedRawOld: number;
  totalDeleted: number;
}

export async function runCleanup(): Promise<CleanupResult> {
  const db = getClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Eliminar processed_news antiguas
  const { data: deletedProcessed, error: processedError } = await db
    .from("processed_news")
    .delete()
    .lt("processed_at", cutoff)
    .select("id");

  if (processedError) {
    log.error("Error eliminando processed_news", processedError.message);
  }

  // 2. Eliminar raw_news antiguas (solo las ya procesadas)
  const { data: deletedRaw, error: rawError } = await db
    .from("raw_news")
    .delete()
    .lt("fetched_at", cutoff)
    .eq("processed", true)
    .select("id");

  if (rawError) {
    log.error("Error eliminando raw_news", rawError.message);
  }

  // 3. Eliminar raw_news muy antiguas sin procesar (>14 dias)
  const oldCutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deletedOldRaw, error: oldRawError } = await db
    .from("raw_news")
    .delete()
    .lt("fetched_at", oldCutoff)
    .eq("processed", false)
    .select("id");

  if (oldRawError) {
    log.error("Error eliminando raw_news antiguas sin procesar", oldRawError.message);
  }

  const deletedProcessedCount = deletedProcessed?.length ?? 0;
  const deletedRawCount = deletedRaw?.length ?? 0;
  const deletedOldRawCount = deletedOldRaw?.length ?? 0;

  return {
    success: true,
    cutoffDate: cutoff,
    deletedProcessed: deletedProcessedCount,
    deletedRawProcessed: deletedRawCount,
    deletedRawOld: deletedOldRawCount,
    totalDeleted: deletedProcessedCount + deletedRawCount + deletedOldRawCount,
  };
}
