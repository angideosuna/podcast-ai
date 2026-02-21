// Generación de guion de podcast usando Claude API

import Anthropic from "@anthropic-ai/sdk";
import type { Article } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";

const log = createLogger("generate-script");

// Número de noticias según duración del podcast
export const ARTICLES_BY_DURATION: Record<number, number> = {
  15: 5,
  30: 8,
  60: 12,
};

// Max tokens de Claude según duración (evita pagar tokens innecesarios)
const MAX_TOKENS_BY_DURATION: Record<number, number> = {
  15: 8192,
  30: 12288,
  60: 16384,
};

// Timeout para la llamada a Claude (55s para dejar margen antes del limite de 60s de Vercel)
const CLAUDE_TIMEOUT_MS = 55_000;

// ──────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Establece la identidad y personalidad del podcaster
// ──────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un podcaster profesional de habla hispana (España) con años de experiencia. Tu trabajo es escribir guiones de podcast que suenen EXACTAMENTE como habla un ser humano real delante de un micrófono: con personalidad, ritmo, emoción y naturalidad.

## TU PERSONALIDAD

- Eres curioso, apasionado y cercano. Te flipan las noticias y se te nota.
- Tienes opiniones propias y no te da miedo compartirlas (sin ser agresivo).
- Hablas como habla la gente DE VERDAD: con muletillas, pausas, cambios de ritmo.
- Te emocionas cuando algo te parece increíble, te indignas cuando algo no tiene sentido.

## CÓMO HABLAS

Usas expresiones naturales del español de España de forma orgánica (varía):
- "A ver, esto es...", "Mira, te cuento...", "O sea...", "Fíjate en esto..."
- "¿Y sabes qué?", "Bueno, pues resulta que...", "Ojo con esto..."
- "Es que flipas...", "Madre mía...", "Esto tiene tela..."

## REGLAS DE ORO

1. NUNCA suenes como un texto escrito. Suena como alguien HABLANDO.
2. Frases cortas mezcladas con alguna más larga. Variedad de ritmo.
3. Preguntas retóricas al oyente. Reacciones genuinas.
4. Cuenta las noticias como HISTORIAS, no como informes.
5. Crea tensión y curiosidad ANTES de soltar la información clave.
6. Transiciones naturales entre temas.

## FRASES PROHIBIDAS — NUNCA uses:

- "En el día de hoy vamos a hablar sobre..."
- "Es importante destacar que..." / "Cabe mencionar que..."
- "En conclusión, podemos decir que..." / "Para finalizar..."
- "A continuación, analizaremos..." / "En primer lugar... En segundo lugar..."
- Cualquier frase que suene a presentador de telediario o ensayo académico`;

// ──────────────────────────────────────────────────────────────────────────────
// INSTRUCCIONES DE TONO — Detalladas con ejemplos de DO vs DON'T
// ──────────────────────────────────────────────────────────────────────────────

const TONE_INSTRUCTIONS: Record<string, string> = {
  casual: `## TONO: CASUAL — Como tu colega que lo sabe todo

Energía alta, coloquial total. Tutea, bromea, reacciona. Registro: "Tío", "flipar", "mola". Opinión directa sin filtro.

COMO SÍ: "Tío, ¿has visto lo que ha hecho Apple? Mira, te lo cuento porque es de esas cosas que dices 'no puede ser'. Han sacado un chip que hace que tu portátil antiguo parezca una calculadora de los 90. Y lo mejor... lo mejor es el precio. Que no te hago spoiler todavía, aguanta."
COMO NO: "Apple ha lanzado hoy su nuevo chip M5, que ofrece un rendimiento significativamente superior. Esta mejora supone un avance importante en el sector."`,

  profesional: `## TONO: PROFESIONAL — El analista al que respetas

Mesurado pero apasionado. Humor sutil, ironías puntuales. Culto pero natural, nada académico. Opiniones argumentadas con matices. Datos con peso.

COMO SÍ: "Esto de la nueva regulación europea me parece fascinante. A simple vista parece otro papeleo burocrático, ¿no? Pues fíjate: por primera vez obligan a las tech a abrir sus algoritmos. Meta, Google, TikTok enseñando cómo deciden lo que ves. ¿Realmente van a cumplir, o van a buscar la trampa?"
COMO NO: "La Unión Europea ha aprobado una nueva regulación que obliga a las empresas tecnológicas a aumentar la transparencia de sus algoritmos."`,

  "deep-dive": `## TONO: DEEP-DIVE — El experto que te vuela la cabeza

Intenso pero controlado. Contexto histórico, conexiones inesperadas. Explica lo complejo de forma accesible. No solo qué pasó, sino POR QUÉ y qué viene después.

COMO SÍ: "Quédate con este dato: la última vez que una empresa de IA fue valorada en más de 100.000 millones sin beneficios fue... nunca. Y ahora llega esta startup y lo consigue en dos años. ¿Te acuerdas de la burbuja punto com? Hay gente seria que predijo aquello viendo patrones parecidos. Aquí es donde se pone interesante..."
COMO NO: "La startup ha alcanzado una valoración de 100.000 millones de dólares. Este hito supone un récord histórico. Los expertos señalan paralelismos con la burbuja del 2000."`,
};

// ──────────────────────────────────────────────────────────────────────────────
// VARIABILIDAD — Pools de aperturas, transiciones y cierres para no repetirse
// ──────────────────────────────────────────────────────────────────────────────

const OPENING_STYLES = [
  "Arranca con la noticia más loca del día, sin contexto, y luego di 'vale, te explico'.",
  "Empieza con una pregunta provocadora sobre la noticia principal que haga que el oyente NECESITE escuchar la respuesta.",
  "Arranca contando una anécdota o dato curioso relacionado con la noticia principal, y luego conecta con el tema del día.",
  "Empieza diciendo que hoy hay una noticia que te ha dejado con la boca abierta, genera expectativa sin revelarla aún.",
  "Arranca con un 'vale, necesito que me expliquéis algo...' y plantea una contradicción o algo que no cuadra de las noticias de hoy.",
  "Empieza compartiendo tu reacción personal al leer las noticias de hoy: qué te sorprendió, qué te cabreó, qué te hizo gracia.",
];

const TRANSITION_STYLES = [
  "Conecta la noticia anterior con la siguiente buscando algún hilo común, por absurdo que sea.",
  "Haz un contraste de mood: si la anterior era seria, alivia con humor; si era graciosa, pon tono serio.",
  "Usa una pregunta retórica que sirva de puente: '¿Y sabes qué tiene que ver esto con...?'",
  "Transición directa y honesta: 'Oye, cambio total de tema porque esto también es bueno...'",
  "Conecta usando tu opinión: 'Y mira, hablando de cosas que me flipan / me preocupan...'",
];

const CLOSING_STYLES = [
  "Cierra con tu opinión personal sobre la noticia que más te ha impactado y lanza una pregunta al oyente.",
  "Haz un mini-resumen rápido e informal (nada de listas), como si le contaras a alguien qué ha pasado hoy en 15 segundos.",
  "Cierra con una reflexión personal o una predicción atrevida sobre algo que has contado hoy.",
  "Despídete con humor, con algún comentario sobre lo loco que está el mundo hoy.",
  "Cierra conectando la primera y la última noticia de forma inesperada.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ──────────────────────────────────────────────────────────────────────────────
// PERFIL DEL OYENTE — Construir bloque contextual a partir del perfil
// ──────────────────────────────────────────────────────────────────────────────

function buildProfileBlock(profile: Record<string, string | null> | null | undefined): string {
  if (!profile) return "";

  const lines: string[] = [];

  if (profile.nombre) {
    lines.push(`- El oyente se llama **${profile.nombre}**. Puedes mencionarlo de forma natural si encaja.`);
  }
  if (profile.rol) {
    lines.push(`- Trabaja como ${profile.rol}${profile.sector ? ` en el sector ${profile.sector}` : ""}.`);
  } else if (profile.sector) {
    lines.push(`- Trabaja en el sector ${profile.sector}.`);
  }
  if (profile.edad) {
    lines.push(`- Tiene ${profile.edad} años.`);
  }
  if (profile.ciudad) {
    lines.push(`- Vive en ${profile.ciudad}.`);
  }

  // Nivel de conocimiento
  if (profile.nivel_conocimiento === "principiante") {
    lines.push(`- Nivel principiante: explica conceptos sin asumir conocimiento previo, usa analogías sencillas.`);
  } else if (profile.nivel_conocimiento === "intermedio") {
    lines.push(`- Nivel intermedio: puede usar terminología del sector pero explica los conceptos más avanzados.`);
  } else if (profile.nivel_conocimiento === "experto") {
    lines.push(`- Nivel experto: usa terminología técnica, ve directo al análisis avanzado, no expliques lo básico.`);
  }

  // Objetivo
  if (profile.objetivo_podcast === "informarme") {
    lines.push(`- Objetivo: informarse. Prioriza datos clave y resúmenes claros, ve al grano.`);
  } else if (profile.objetivo_podcast === "aprender") {
    lines.push(`- Objetivo: aprender en profundidad. Añade contexto, conexiones entre temas y análisis detallado.`);
  } else if (profile.objetivo_podcast === "entretenerme") {
    lines.push(`- Objetivo: entretenerse. Contenido dinámico, divertido, con personalidad y ritmo ágil.`);
  }

  // Horario — derivar franja del día a partir de la hora (formato "HH:MM" o legacy)
  if (profile.horario_escucha) {
    const hora = parseInt(profile.horario_escucha.split(":")[0], 10);
    if (!isNaN(hora)) {
      if (hora >= 5 && hora < 12) {
        lines.push(`- Escucha por la mañana: energía para empezar el día, tono motivador y dinámico.`);
      } else if (hora >= 12 && hora < 15) {
        lines.push(`- Escucha al mediodía: tono equilibrado, buen ritmo para la pausa del día.`);
      } else if (hora >= 15 && hora < 20) {
        lines.push(`- Escucha por la tarde: tono reflexivo pero entretenido.`);
      } else {
        lines.push(`- Escucha por la noche: tono relajado y de cierre del día, sin exceso de energía.`);
      }
    } else if (profile.horario_escucha === "manana") {
      lines.push(`- Escucha por la mañana: energía para empezar el día, tono motivador y dinámico.`);
    } else if (profile.horario_escucha === "mediodia") {
      lines.push(`- Escucha al mediodía: tono equilibrado, buen ritmo para la pausa del día.`);
    } else if (profile.horario_escucha === "tarde") {
      lines.push(`- Escucha por la tarde: tono reflexivo pero entretenido.`);
    } else if (profile.horario_escucha === "noche") {
      lines.push(`- Escucha por la noche: tono relajado y de cierre del día, sin exceso de energía.`);
    }
  }

  if (lines.length === 0) return "";

  return `\n\n## PERFIL DEL OYENTE

Adapta el contenido y el tono teniendo en cuenta este perfil:
${lines.join("\n")}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ──────────────────────────────────────────────────────────────────────────────

// Cliente Anthropic singleton (se reutiliza entre peticiones)
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (anthropicClient) return anthropicClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada en las variables de entorno");
  }
  anthropicClient = new Anthropic({ apiKey });
  return anthropicClient;
}

export async function generateScript(
  articles: Article[],
  duration: number,
  tone: string,
  adjustments?: string,
  profile?: Record<string, string | null> | null,
  insights?: string | null
): Promise<string> {
  const client = getAnthropicClient();
  log.info(`Generando guion: ${duration} min, tono ${tone}, ${articles.length} artículos`);

  const articleCount = ARTICLES_BY_DURATION[duration] || 5;
  const selectedArticles = articles.slice(0, articleCount);
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.casual;

  // Calcular tiempos orientativos (referencia, no camisa de fuerza)
  const introSeconds = duration === 15 ? 45 : 60;
  const closingSeconds = duration === 15 ? 45 : 60;
  const totalNewsSeconds = duration * 60 - introSeconds - closingSeconds;
  const secondsPerArticle = Math.floor(totalNewsSeconds / selectedArticles.length);

  // Formatear las noticias para el prompt (sanitizar newlines, truncar descripción)
  const sanitize = (s: string) => s.replace(/[\n\r]+/g, " ").trim();
  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max).trimEnd() + "..." : s;
  const newsContext = selectedArticles
    .map(
      (a, i) =>
        `NOTICIA ${i + 1}:\n- Titular: ${sanitize(a.title)}\n- Resumen: ${truncate(sanitize(a.description), 200)}\n- Fuente: ${a.source}\n- URL: ${a.url}`
    )
    .join("\n\n");

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Seleccionar variaciones aleatorias para este episodio
  const openingStyle = pickRandom(OPENING_STYLES);
  const transitionStyle = pickRandom(TRANSITION_STYLES);
  const closingStyle = pickRandom(CLOSING_STYLES);

  const wordsPerMinute = 160;
  const totalWords = duration * wordsPerMinute;

  // Construir bloque de perfil del oyente
  const profileBlock = buildProfileBlock(profile);

  const prompt = `Escribe el guion de mi podcast de hoy. Duración: ~${duration} minutos (~${totalWords} palabras).
Fecha: ${today}.

## NOTICIAS DE HOY

${newsContext}

## INSTRUCCIONES DE ESTILO

${toneInstruction}

## ESTRUCTURA (flexible, NO rígida)

El guion debe tener estas partes, pero las transiciones deben ser INVISIBLES — que el oyente no note dónde acaba una sección y empieza otra:

**APERTURA (~${introSeconds}s):** ${openingStyle}
NO saludes con "hola, bienvenidos a PodCast.ai". Arranca directamente con contenido interesante. El nombre del podcast puede aparecer de forma natural, pero no como saludo corporativo.

**NOTICIAS (${selectedArticles.length} noticias, ~${secondsPerArticle}s cada una):**
- Cuenta cada noticia como una HISTORIA, no como un titular + análisis.
- Varía la estructura: no todas las noticias deben seguir el mismo patrón.
- Algunas pueden empezar con un dato impactante, otras con una pregunta, otras con tu reacción.
- TRANSICIONES: ${transitionStyle}
- Cita la fuente de forma natural dentro del texto ("según publica [fuente]", "lo contaba [fuente] esta mañana").

**CIERRE (~${closingSeconds}s):** ${closingStyle}

## FORMATO DE SALIDA

Escribe en Markdown:
- Usa # para el título del episodio (incluye 🎙️ y la fecha)
- Usa ## para separar las secciones principales
- Usa --- entre secciones
- Usa **negrita** para énfasis en palabras o frases clave
- El título del episodio NO debe ser "Briefing del [fecha]". Inventa un título creativo basado en las noticias.

## REGLAS INQUEBRANTABLES

1. Idioma: Español de España (no latinoamericano)
2. NO inventes datos ni noticias. Usa SOLO la información proporcionada.
3. El guion es para LEER EN VOZ ALTA. Cada frase debe sonar natural hablada.
4. ~${wordsPerMinute} palabras por minuto de audio. Total: ~${totalWords} palabras.
5. Sé humano. Sé real. Sé interesante. Si un trozo suena a "generado por IA", reescríbelo.${profileBlock}${
    insights ? `\n\n${insights}` : ""
  }${
    adjustments
      ? `\n\n## AJUSTES DEL USUARIO\n\nEl oyente ha pedido estos cambios:\n${adjustments}\n\nAdapta el contenido según estas indicaciones.`
      : ""
  }`;

  const maxTokens = MAX_TOKENS_BY_DURATION[duration] || 8192;

  const message = await withRetry(
    async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CLAUDE_TIMEOUT_MS);

      try {
        return await client.messages.create(
          {
            model: "claude-sonnet-4-20250514",
            max_tokens: maxTokens,
            system: [
              {
                type: "text",
                text: SYSTEM_PROMPT,
                cache_control: { type: "ephemeral" },
              },
            ],
            messages: [
              {
                role: "user",
                content: prompt,
              },
            ],
          },
          { signal: controller.signal }
        );
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          throw new Error("La generación del guion ha excedido el tiempo límite (55s). Intenta con una duración más corta.");
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    },
    { maxRetries: 2, baseDelayMs: 2000, maxDelayMs: 8000, label: "claude-generate-script" }
  );

  // Extraer el texto de la respuesta
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No se recibió texto en la respuesta de Claude");
  }

  log.info(`Guion generado: ${textBlock.text.length} caracteres`);
  return textBlock.text;
}
