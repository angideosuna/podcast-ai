// CLI: npm run agent:cleanup
// Elimina noticias antiguas (>7 dias) de raw_news y processed_news

import { loadEnv } from "../utils/env";
loadEnv();

import { runCleanup } from "./cleanup-core";

async function main() {
  console.log("\n🧹 News Agent — Limpieza de noticias antiguas\n");

  const result = await runCleanup();

  console.log(`Eliminando noticias anteriores a: ${result.cutoffDate}\n`);
  console.log(`  processed_news: ${result.deletedProcessed} eliminadas`);
  console.log(`  raw_news (procesadas): ${result.deletedRawProcessed} eliminadas`);
  if (result.deletedRawOld > 0) {
    console.log(`  raw_news (sin procesar, >14d): ${result.deletedRawOld} eliminadas`);
  }
  console.log(`\nTotal: ${result.totalDeleted} registros eliminados\n`);
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
