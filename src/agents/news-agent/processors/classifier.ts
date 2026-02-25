// Clasificador IA — usa Claude para analizar y clasificar noticias
// Envía batches de artículos para minimizar llamadas a la API

import Anthropic from "@anthropic-ai/sdk";
import { createLogger } from "@/lib/logger";
import type { RawNewsItem, ProcessedNewsItem } from "../utils/types";

const log = createLogger("agent:classifier");

const BATCH_SIZE = 10; // artículos por llamada a Claude

interface ClassificationResult {
  index: number;
  category: string;
  relevance_score: number;
  summary: string;
  language: string;
  keywords: string[];
  sentiment: "positive" | "negative" | "neutral";
  impact_scope: "local" | "national" | "global";
  story_id: string;
}

const VALID_SENTIMENTS = new Set(["positive", "negative", "neutral"]);
const VALID_SCOPES = new Set(["local", "national", "global"]);

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  client = new Anthropic();
  return client;
}

/** Clasifica un batch de artículos con Claude */
async function classifyBatch(
  items: RawNewsItem[]
): Promise<ClassificationResult[]> {
  const anthropic = getClient();

  // Construir la lista de artículos para el prompt
  const articleList = items
    .map(
      (item, i) =>
        `[${i}] Título: ${item.title}\n    Descripción: ${item.description || "N/A"}\n    Fuente: ${item.source_name}\n    Idioma original: ${item.language}`
    )
    .join("\n\n");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: `Eres un clasificador de noticias. Analiza cada artículo y devuelve un JSON array con la clasificación.

Categorías válidas: technology, science, business, health, entertainment, sports, politics, general

Para relevance_score (1-10):
- 9-10: Noticia de impacto mundial, breaking news
- 7-8: Noticia relevante del día, interesante para muchas personas
- 5-6: Noticia moderadamente interesante
- 3-4: Noticia menor o muy local
- 1-2: Contenido irrelevante o spam

Para sentiment:
- "positive": La noticia tiene un tono positivo (avances, logros, buenas noticias)
- "negative": La noticia tiene un tono negativo (crisis, conflictos, problemas, desastres)
- "neutral": La noticia es informativa sin carga emocional clara

Para impact_scope:
- "local": Afecta a una ciudad, región o comunidad específica
- "national": Afecta a un país entero
- "global": Afecta a múltiples países o tiene relevancia internacional

Para story_id:
- Identificador corto en kebab-case (minúsculas, separado por guiones) que agrupe noticias del mismo tema o historia
- Máximo 50 caracteres
- Si dos artículos del batch hablan del mismo tema, DEBEN tener el mismo story_id
- Ejemplos: "regulacion-ia-ue-2026", "crisis-energetica-europa", "apple-wwdc-2026", "mision-artemis-nasa"
- Sé consistente: usa el mismo patrón para noticias relacionadas

NOTICIAS EN INGLÉS:
Si el artículo está en inglés, tu resumen en español DEBE:
- Mantener los nombres propios en su idioma original (no traducir "Apple" ni "Wall Street")
- Incluir la fuente entre paréntesis al final: "(según BBC)" o "(reporta The Guardian)"
- Si hay terminología técnica, poner el término en español Y en inglés entre paréntesis: "cadena de suministro (supply chain)"
- Aportar contexto cultural si es necesario: si la noticia es sobre política británica, explicar brevemente qué implica para un oyente español

IMPORTANTE: Responde SOLO con el JSON array, sin markdown ni explicaciones.`,
    messages: [
      {
        role: "user",
        content: `Clasifica estos ${items.length} artículos. Para cada uno devuelve: index, category, relevance_score (1-10), summary (resumen RICO en español, 3-4 frases, DEBE incluir datos concretos como cifras/porcentajes/fechas, nombres de personas/empresas/países relevantes, y el impacto práctico — NO resumas genéricamente), language (es/en), keywords (3-5 palabras clave), sentiment (positive/negative/neutral), impact_scope (local/national/global), story_id (kebab-case, max 50 chars).

${articleList}

Responde SOLO con un JSON array:
[{"index": 0, "category": "...", "relevance_score": N, "summary": "...", "language": "...", "keywords": ["..."], "sentiment": "...", "impact_scope": "...", "story_id": "..."}, ...]`,
      },
    ],
  });

  // Extraer el texto de la respuesta
  const text =
    response.content[0].type === "text" ? response.content[0].text : "";

  // Parsear JSON (limpiar posible markdown)
  const cleaned = text.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(cleaned);
    // Si Claude devuelve un objeto en vez de array, wrappear en array
    const results: ClassificationResult[] = Array.isArray(parsed) ? parsed : [parsed];
    // Validar cada resultado con defaults
    return results.map((r) => ({
      index: typeof r.index === "number" ? r.index : 0,
      category: typeof r.category === "string" ? r.category : "general",
      relevance_score: typeof r.relevance_score === "number" ? r.relevance_score : 5,
      summary: typeof r.summary === "string" ? r.summary : "Sin resumen",
      language: typeof r.language === "string" ? r.language : "es",
      keywords: Array.isArray(r.keywords) ? r.keywords : [],
      sentiment: VALID_SENTIMENTS.has(r.sentiment) ? r.sentiment : "neutral",
      impact_scope: VALID_SCOPES.has(r.impact_scope) ? r.impact_scope : "national",
      story_id: typeof r.story_id === "string" ? r.story_id.slice(0, 50) : "uncategorized",
    }));
  } catch {
    // Intentar reparar JSON con trailing comma
    try {
      const repaired = cleaned.replace(/,\s*([\]}])/g, "$1");
      const parsed = JSON.parse(repaired);
      const results: ClassificationResult[] = Array.isArray(parsed) ? parsed : [parsed];
      return results.map((r) => ({
        index: typeof r.index === "number" ? r.index : 0,
        category: typeof r.category === "string" ? r.category : "general",
        relevance_score: typeof r.relevance_score === "number" ? r.relevance_score : 5,
        summary: typeof r.summary === "string" ? r.summary : "Sin resumen",
        language: typeof r.language === "string" ? r.language : "es",
        keywords: Array.isArray(r.keywords) ? r.keywords : [],
        sentiment: VALID_SENTIMENTS.has(r.sentiment) ? r.sentiment : "neutral",
        impact_scope: VALID_SCOPES.has(r.impact_scope) ? r.impact_scope : "national",
        story_id: typeof r.story_id === "string" ? r.story_id.slice(0, 50) : "uncategorized",
      }));
    } catch {
      log.error("Error parseando respuesta de Claude", cleaned.slice(0, 200));
      return [];
    }
  }
}

/** Clasifica todas las noticias en batches */
export async function classifyWithAI(
  items: RawNewsItem[]
): Promise<ProcessedNewsItem[]> {
  log.info(`Clasificando ${items.length} noticias con Claude (batches de ${BATCH_SIZE})...`);

  const processed: ProcessedNewsItem[] = [];
  const totalBatches = Math.ceil(items.length / BATCH_SIZE);

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    log.info(`  Batch ${batchNum}/${totalBatches} (${batch.length} artículos)...`);

    let results: ClassificationResult[] | null = null;

    try {
      results = await classifyBatch(batch);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error";
      log.warn(`  Batch ${batchNum} falló: ${msg}, reintentando en 3s...`);
      await new Promise((r) => setTimeout(r, 3000));
      try {
        results = await classifyBatch(batch);
      } catch (retryErr) {
        const retryMsg = retryErr instanceof Error ? retryErr.message : "Error";
        log.error(`  Batch ${batchNum} falló tras reintento: ${retryMsg}`);
      }
    }

    if (results) {
      for (const result of results) {
        const item = batch[result.index];
        if (!item) {
          log.warn(`  Índice inválido en respuesta: ${result.index}`);
          continue;
        }

        // Validar relevance_score
        const score = Math.max(1, Math.min(10, Math.round(result.relevance_score)));

        processed.push({
          raw_news_id: item.id!,
          title: item.title,
          summary: result.summary || "Sin resumen",
          category: result.category || item.category || "general",
          relevance_score: score,
          language: result.language || item.language,
          keywords: result.keywords || [],
          sentiment: result.sentiment,
          impact_scope: result.impact_scope,
          story_id: result.story_id,
          url: item.url,
          source_name: item.source_name,
          published_at: item.published_at,
        });
      }

      log.info(`  Batch ${batchNum}: ${results.length} clasificadas OK`);
    }
  }

  log.info(`Clasificación completa: ${processed.length}/${items.length} noticias procesadas`);
  return processed;
}
