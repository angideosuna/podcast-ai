// CLI: npm run agent:top
// Muestra las 10 noticias más relevantes de hoy

import { loadEnv } from "../utils/env";
loadEnv();

import { NewsAgent } from "../index";

async function main() {
  const date = process.argv[2]; // Opcional: npm run agent:top 2026-02-19
  const today = date ?? new Date().toISOString().split("T")[0];

  console.log(`\n🏆 News Agent — Top 10 noticias del ${today}\n`);

  const agent = new NewsAgent();
  const news = await agent.getTopNews(10, date);

  if (news.length === 0) {
    console.log("No hay noticias procesadas para esta fecha.");
    console.log("Ejecuta primero: npm run agent:fetch && npm run agent:process\n");
    return;
  }

  for (let i = 0; i < news.length; i++) {
    const item = news[i];
    console.log(`${i + 1}. [${item.relevance_score}/10] ${item.title}`);
    console.log(`   Categoría: ${item.category} | Fuente: ${item.source_name}`);
    console.log(`   ${item.summary}`);
    console.log(`   🔗 ${item.url}`);
    console.log();
  }
}

main().catch((err) => {
  console.error("Error fatal:", err);
  process.exit(1);
});
