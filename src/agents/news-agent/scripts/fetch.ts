// CLI: npm run agent:fetch
// Ejecuta una búsqueda manual de todas las fuentes configuradas

import { loadEnv } from "../utils/env";
loadEnv();

import { runFetchNews } from "./fetch-core";

async function main() {
  console.log("\n📡 News Agent — Fetch de noticias\n");

  const result = await runFetchNews();

  // Resumen
  console.log("\n--- Resumen ---");
  for (const r of result.details) {
    const status = r.success ? "OK" : "FAIL";
    const icon = r.success ? "✅" : "❌";
    console.log(
      `${icon} [${status}] ${r.source_name}: ${r.items} noticias (${r.duration_ms}ms)`
    );
    if (r.error) console.log(`   └─ Error: ${r.error}`);
  }

  console.log(
    `\nTotal: ${result.sourcesOk}/${result.sourcesTotal} fuentes OK, ${result.articlesFound} noticias recogidas\n`
  );
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
