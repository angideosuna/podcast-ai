// CLI: npm run agent:process
// Procesa las noticias raw pendientes (dedup + clasificación IA)

import { loadEnv } from "../utils/env";
loadEnv();

import { runProcessNews } from "./process-core";

async function main() {
  console.log("\n🧠 News Agent — Procesar noticias\n");

  const result = await runProcessNews();

  if (result.processed === 0) {
    console.log("No se procesaron noticias (ninguna pendiente o procesador no implementado)\n");
    return;
  }

  console.log(`\n--- ${result.processed} noticias procesadas ---`);
  for (const item of result.details) {
    console.log(
      `  [${item.relevance_score}/10] [${item.category}] ${item.title}`
    );
  }
  console.log();
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
