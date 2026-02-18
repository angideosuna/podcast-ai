// Generación de guion de podcast usando Claude API

import Anthropic from "@anthropic-ai/sdk";
import { Article } from "./newsapi";

// Número de noticias según duración del podcast
const ARTICLES_BY_DURATION: Record<number, number> = {
  5: 3,
  15: 5,
  30: 8,
};

// Instrucciones de estilo según tono
const TONE_INSTRUCTIONS: Record<string, string> = {
  casual: `Tono casual y cercano. Como un amigo que sabe mucho y te cuenta las noticias
tomando un café. Usa expresiones coloquiales ("mira", "ojo con esto", "la verdad es que...").
Tutea al oyente. Puedes usar humor ligero.`,

  profesional: `Tono profesional pero accesible. Como un analista que te da un briefing
ejecutivo. Datos concretos, análisis claro, sin rodeos. Usa un registro formal pero no
acartonado. Puedes tutear pero mantén la seriedad.`,

  "deep-dive": `Tono analítico y en profundidad. Como un experto en un podcast largo.
Explica el contexto histórico, las implicaciones a futuro, las conexiones entre temas.
Cada noticia merece una reflexión más profunda. Incluye datos y cifras cuando sea posible.`,
};

export async function generateScript(
  articles: Article[],
  duration: number,
  tone: string,
  adjustments?: string
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada en las variables de entorno");
  }

  const client = new Anthropic({ apiKey });

  const articleCount = ARTICLES_BY_DURATION[duration] || 5;
  const selectedArticles = articles.slice(0, articleCount);
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.casual;

  // Calcular tiempos por sección según duración
  const introSeconds = duration === 5 ? 30 : duration === 15 ? 45 : 60;
  const closingSeconds = duration === 5 ? 30 : duration === 15 ? 45 : 60;
  const totalNewsSeconds = duration * 60 - introSeconds - closingSeconds;
  const secondsPerArticle = Math.floor(totalNewsSeconds / selectedArticles.length);

  // Formatear las noticias para el prompt
  const newsContext = selectedArticles
    .map(
      (a, i) =>
        `NOTICIA ${i + 1}:\n- Titular: ${a.title}\n- Descripción: ${a.description}\n- Fuente: ${a.source}\n- URL: ${a.url}\n- Fecha: ${a.publishedAt}`
    )
    .join("\n\n");

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `Genera un guion de podcast de ${duration} minutos basado en estas noticias reales de hoy.

## NOTICIAS DISPONIBLES

${newsContext}

## FORMATO DEL GUION

Escribe en formato Markdown con esta estructura:

# 🎙️ PodCast.ai — Briefing del ${today}

---

## [INTRO - ${introSeconds} segundos]
Un saludo cercano. Menciona cuántas noticias traes hoy.
Da un adelanto de la noticia más impactante para enganchar al oyente.

${selectedArticles
  .map(
    (_, i) =>
      `## [NOTICIA ${i + 1} - ${secondsPerArticle} segundos] {Titular atractivo}
Titular → Contexto → Por qué importa → Opinión breve
(Fuente: nombre de la fuente)

---`
  )
  .join("\n\n")}

## [CIERRE - ${closingSeconds} segundos]
Resumen rápido de todos los temas.
Una pregunta abierta para el oyente.
Despedida.

---

*Duración estimada: ~${duration} minutos | Generado por PodCast.ai*

## ESTILO

${toneInstruction}

## REGLAS IMPORTANTES

- Idioma: Español de España
- Transiciones naturales entre noticias ("Y mira, esto es lo bueno...", "Ahora viene lo fuerte...", "Cambiamos de tema...")
- Si hay un término técnico, explícalo en una frase
- Incluir la fuente entre paréntesis después de cada noticia
- NO inventes datos ni noticias. Usa SOLO la información proporcionada
- El guion debe ser fluido, como si alguien lo fuera a leer en voz alta
- Cada sección debe respetar aproximadamente el tiempo indicado (unas 150 palabras por minuto de audio)${
    adjustments
      ? `\n\n## AJUSTES DEL USUARIO\n\nEl usuario ha pedido los siguientes ajustes para este episodio:\n${adjustments}\n\nAdapta el contenido según estas indicaciones manteniendo la estructura general del guion.`
      : ""
  }`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  // Extraer el texto de la respuesta
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No se recibió texto en la respuesta de Claude");
  }

  return textBlock.text;
}
