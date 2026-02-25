// Generación de guion de podcast usando Claude API

import Anthropic from "@anthropic-ai/sdk";
import type { Article } from "@/lib/types";
import { createLogger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";
import { TOPIC_TO_CATEGORIES } from "@/lib/topics";

export interface TrendingTopicInfo {
  topic: string;
  score: number;
  article_count: number;
  category: string | null;
}

const log = createLogger("generate-script");

// Número de noticias según duración del podcast
export const ARTICLES_BY_DURATION: Record<number, number> = {
  5: 2,
  15: 5,
  30: 8,
  60: 12,
};

// Max tokens de Claude según duración (evita pagar tokens innecesarios)
const MAX_TOKENS_BY_DURATION: Record<number, number> = {
  5: 4096,
  15: 8192,
  30: 12288,
  60: 16384,
};

// Timeout de seguridad largo — el streaming mantiene la conexión viva,
// este timeout solo protege contra un hang total de la API
const CLAUDE_TIMEOUT_MS = 180_000; // 3 minutos

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
  "Abre con la noticia más impactante directamente, sin saludar. Luego saluda brevemente.",
  "Abre con una pregunta provocadora sobre el tema principal del día.",
  "Abre con un dato numérico sorprendente de una de las noticias.",
  "Abre con una predicción que hiciste en un episodio anterior (invéntala) y di si se cumplió.",
  "Abre con un 'Hoy es uno de esos días en los que las noticias se conectan de una forma que da miedo...'",
  "Abre contando una anécdota breve (puede ser inventada) que conecte con la primera noticia.",
  "Abre con un contraste entre dos noticias del día: una buena y una mala.",
  "Abre con un 'Si solo pudieras saber una cosa hoy, sería esta:' y suelta el titular más potente.",
];

const TRANSITION_STYLES = [
  "Conecta las noticias con causa-efecto: 'Y esto tiene mucho que ver con lo que está pasando en...'",
  "Usa contraste: 'Pero mientras esto ocurre, al otro lado del mundo...'",
  "Usa pregunta retórica: '¿Y sabéis qué tiene que ver esto con...?'",
  "Usa dato puente: 'Y hablando de números, fijaos en este dato...'",
  "Usa temporal: 'Y justo esta semana, como si fuera una respuesta a esto...'",
  "Usa geográfico: 'Y si miramos cómo afecta esto más cerca de casa...'",
  "Usa impacto personal: 'Y esto nos toca de cerca porque...'",
  "Usa humor/ironía suave: 'Y como si el universo tuviera sentido del humor...'",
];

const CLOSING_STYLES = [
  "Cierra conectando la primera y última noticia en un arco narrativo circular.",
  "Cierra con una predicción concreta para la próxima semana basada en lo que has contado.",
  "Cierra con una pregunta abierta al oyente: '¿Vosotros qué pensáis, estamos mejor o peor que ayer?'",
  "Cierra con el dato más sorprendente del episodio, como bomba final.",
  "Cierra con una reflexión personal breve y honesta sobre lo que te ha hecho sentir el día de hoy.",
  "Cierra con un 'mini-resumen emocional': no los hechos, sino cómo te dejan las noticias de hoy.",
];

const EPISODE_FORMATS = [
  "FORMATO CLÁSICO: Saludo → noticias en orden de narrativa → cierre",
  "FORMATO 'LO MEJOR Y LO PEOR': Abre con la mejor noticia del día, luego la peor, luego el resto con contexto",
  "FORMATO DEBATE INTERNO: Presenta cada noticia con dos ángulos opuestos, como si debatieras contigo mismo. '¿Por un lado... pero por otro...'",
  "FORMATO COUNTDOWN: Presenta las noticias de menor a mayor impacto, como un ranking. 'Empezamos con una interesante y vamos subiendo...'",
  "FORMATO HILO CONDUCTOR: Encuentra UN tema que conecte TODAS las noticias y haz que todo el episodio gire alrededor de esa idea central",
  "FORMATO PREGUNTA DEL DÍA: Abre con una gran pregunta y cada noticia aporta una pieza de la respuesta",
];

const SURPRISE_INTROS = [
  "Y ahora una que no esperabas pero que merece la pena...",
  "Cambiamos de tercio total con algo que me ha llamado mucho la atención...",
  "Y para terminar, algo completamente diferente que no te puedes perder...",
  "Bonus track del día, una noticia fuera de tu radar pero brutal...",
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
  insights?: string | null,
  trending?: TrendingTopicInfo[] | null,
  userTopics?: string[],
  previousEpisodes?: { title: string; topics: string[] }[] | null
): Promise<string> {
  const client = getAnthropicClient();
  log.info(`Generando guion: ${duration} min, tono ${tone}, ${articles.length} artículos`);

  const articleCount = ARTICLES_BY_DURATION[duration] || 5;
  const selectedArticles = articles.slice(0, articleCount);
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.casual;

  // Calcular tiempos orientativos (referencia, no camisa de fuerza)
  const introSeconds = duration <= 5 ? 20 : duration === 15 ? 45 : 60;
  const closingSeconds = duration <= 5 ? 20 : duration === 15 ? 45 : 60;
  const totalNewsSeconds = duration * 60 - introSeconds - closingSeconds;
  const secondsPerArticle = Math.floor(totalNewsSeconds / selectedArticles.length);

  // Formatear las noticias para el prompt (sanitizar newlines, truncar descripción)
  const sanitize = (s: string) => s.replace(/[\n\r]+/g, " ").trim();
  const truncate = (s: string, max: number) => s.length > max ? s.slice(0, max).trimEnd() + "..." : s;
  const newsContext = selectedArticles
    .map((a, i) => {
      let entry = `NOTICIA ${i + 1}:\n- Titular: ${sanitize(a.title || "Sin título")}\n- Fuente: ${a.source || "Fuente desconocida"}`;
      if (a.sentiment || a.impact_scope) {
        entry += `\n- Sentimiento: ${a.sentiment || "neutral"} | Alcance: ${a.impact_scope || "national"}`;
      }
      entry += `\n- Resumen: ${truncate(sanitize(a.description || ""), 300)}`;
      if (a.keywords && a.keywords.length > 0) {
        entry += `\n- Keywords: ${a.keywords.join(", ")}`;
      }
      if (a.related_articles && a.related_articles.length > 0) {
        const titles = a.related_articles.map((r) => `"${sanitize(r.title)}"`).join(", ");
        entry += `\n- [RELACIONADAS: ${titles}]`;
      }
      return entry;
    })
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
  const episodeFormat = pickRandom(EPISODE_FORMATS);

  const wordsPerMinute = 160;
  const totalWords = duration * wordsPerMinute;

  // Construir bloque de perfil del oyente
  const profileBlock = buildProfileBlock(profile);

  // ── Bloque A: Trending topics ──
  const trendingBlock =
    trending && trending.length > 0
      ? `\n\n## TEMAS TRENDING HOY\n\nLos siguientes temas son tendencia hoy. Si alguna de las noticias que vas a contar coincide con estos temas, menciónalo naturalmente (ej: "y esto es precisamente lo que más se está hablando hoy..."). No fuerces la mención si no hay relación.\n${trending.map((t, i) => `${i + 1}. ${t.topic} (score: ${t.score}, artículos: ${t.article_count})`).join("\n")}`
      : "";

  // ── Bloque C: Profundidad informativa (adaptada por duración) ──
  let depthInstruction: string;
  if (duration <= 5) {
    depthInstruction = "Para cada noticia: QUÉ pasó (1-2 frases) + POR QUÉ importa (impacto real en la vida del oyente). No hay tiempo para más.";
  } else if (duration <= 15) {
    depthInstruction = "Para cada noticia: QUÉ pasó + POR QUÉ importa + CONTEXTO (qué venía pasando antes, por qué ahora).";
  } else {
    depthInstruction = "Para las noticias principales: QUÉ pasó + POR QUÉ importa + CONTEXTO (qué venía pasando antes) + Y AHORA QUÉ (qué puede pasar a continuación, predicción o reflexión).";
  }

  const depthBlock = `\n\n## PROFUNDIDAD INFORMATIVA

Para cada noticia, NO te limites a contar QUÉ ha pasado. ${depthInstruction}

Cuando una noticia tenga sentiment "negative", no la cuentes de forma alarmista. Contextualiza: "Suena preocupante, pero vamos a poner esto en perspectiva..."
Cuando tenga sentiment "positive", no seas ingenuo. Analiza: "Es una buena noticia, aunque hay matices..."`;

  // ── Bloque: Datos que impactan ──
  const dataImpactBlock = `\n\n## DATOS QUE IMPACTAN

En CADA noticia, busca el dato más sorprendente del summary (una cifra, un porcentaje, una comparación) y úsalo como ANCLA. El oyente recuerda datos concretos, no resúmenes vagos.

Técnicas:
- Comparación visual: "Eso es como si toda la población de España se mudara de casa en un mes"
- Dato en perspectiva: "Para que os hagáis una idea, eso es más que el PIB de 40 países juntos"
- Pregunta retórica con dato: "¿Sabéis cuántas veces ha pasado esto antes? Exacto, nunca"
- Contraste temporal: "Hace solo 2 años esto era impensable, y hoy ya es ley"

Si una noticia NO tiene ningún dato concreto en su resumen, entonces aporta contexto que dé peso: quién está detrás, cuánta gente afecta, o qué precedente rompe.`;

  // ── Bloque de ritmo ──
  const rhythmBlock = `\n\n## RITMO Y ENERGÍA

Varía el ritmo DENTRO del episodio. No mantengas la misma energía todo el rato:
- Empieza con energía alta (gancho)
- Baja para noticias que requieren reflexión
- Sube para datos sorprendentes o noticias positivas
- Usa frases cortas para momentos de impacto. Frases largas para contexto y análisis.
- Mete pausas dramáticas con "..." antes de revelar un dato importante
- Usa la segunda persona: "Piénsalo así..." / "Imagínate que..." / "Esto te afecta porque..."`;

  // ── Bloque D: Noticias relacionadas ──
  const hasRelated = selectedArticles.some((a) => a.related_articles && a.related_articles.length > 0);
  const relatedBlock = hasRelated
    ? `\n\n## NOTICIAS RELACIONADAS\n\nAlgunas noticias están agrupadas porque son parte de la misma historia. Cuando veas [RELACIONADAS: ...], cuenta la historia principal y menciona brevemente los otros ángulos. Ejemplo: "Y sobre este mismo tema, también sabemos que..." o "Esto se suma a lo que contaban desde [fuente]..."`
    : "";

  // ── Bloque de saludo personalizado ──
  const nombre = profile?.nombre || null;
  const greetingBlock = nombre
    ? `\n\n## SALUDO PERSONALIZADO

SIEMPRE empieza el podcast con un saludo cálido y natural al oyente POR SU NOMBRE. Eres su amigo que le cuenta las noticias, no un presentador de televisión.

El oyente se llama **${nombre}**. Empieza con algo como (VARÍA cada episodio):
- "¡Ey ${nombre}! ¿Qué tal va el día? Venga, siéntate que hoy tengo unas cuantas cosas que contarte..."
- "¡Buenas ${nombre}! ¿Cómo andamos? Mira, hoy hay movimiento, te cuento..."
- "${nombre}, ¿qué pasa? Pilla un café que hoy hay tela..."
- "¡Hola ${nombre}! Espero que estés bien. Oye, hoy me he topado con unas noticias que te van a flipar..."
- "¿Qué tal ${nombre}? Yo aquí, con ganas de contarte lo que está pasando hoy..."

Adapta el saludo según:
- HORARIO: Si es de mañana → "¿Qué tal has dormido?" / "Empezamos el día fuerte". Si es de noche → "¿Qué tal el día?" / "Relájate que yo te pongo al día"
- TONO: Si es casual → muy coloquial, tuteo total. Si es profesional → cercano pero algo más contenido. Si es deep-dive → "Hoy tenemos tema, prepárate"
- VARIABILIDAD: NUNCA repitas el mismo saludo. Cada episodio debe sonar diferente.

Después del saludo (máximo 2-3 frases), engancha DIRECTAMENTE con la primera noticia. Nada de "hoy vamos a hablar de...". Ve al grano: "Porque mira, hoy ha pasado una cosa que..." o "Y te digo esto porque fíjate lo que acaba de salir..."`
    : `\n\n## SALUDO

Empieza con un saludo breve, cálido y natural (2-3 frases máximo). Eres un amigo contando las noticias, no un presentador de televisión. Varía cada episodio: "¡Ey! ¿Qué tal?", "¡Buenas! ¿Cómo andamos?", etc. Después engancha DIRECTAMENTE con la primera noticia.`;

  // ── Noticia sorpresa ──
  let surpriseInstruction = "";
  if (userTopics && userTopics.length > 0 && selectedArticles.length > 0) {
    const userCategories = new Set(userTopics.flatMap((t) => TOPIC_TO_CATEGORIES[t] ?? []));
    const lastArticle = selectedArticles[selectedArticles.length - 1];
    if (lastArticle.category && !userCategories.has(lastArticle.category)) {
      const surpriseIntro = pickRandom(SURPRISE_INTROS);
      surpriseInstruction = `\n- NOTICIA SORPRESA: La última noticia ("${sanitize(lastArticle.title).slice(0, 60)}...") es un tema fuera de las categorías habituales del oyente. Introdúcela con algo como: "${surpriseIntro}"`;
    }
  }

  // ── Bloque de anti-repetición ──
  const antiRepetitionBlock =
    previousEpisodes && previousEpisodes.length > 0
      ? `\n\n## ANTI-REPETICIÓN

Estos son los títulos de los últimos episodios de este oyente:
${previousEpisodes.map((e) => `- "${sanitize(e.title)}"`).join("\n")}

Si alguna de las noticias de hoy ya fue cubierta en estos episodios, NO la repitas como si fuera nueva. En su lugar, dale un ángulo diferente: "¿Os acordáis de lo que os conté sobre X? Pues hay novedades..." o "Esto conecta con lo que hablamos el otro día sobre...". Si no hay novedades relevantes sobre esa noticia, simplemente omítela y dedica más tiempo a las otras.`
      : "";

  const prompt = `Escribe el guion de mi podcast de hoy. Duración: ~${duration} minutos (~${totalWords} palabras).
Fecha: ${today}.${depthBlock}${dataImpactBlock}

## FORMATO DE HOY

${episodeFormat}
Sigue este formato para estructurar el episodio de hoy. Cada día usamos un formato diferente para que el podcast nunca sea predecible.

## NOTICIAS DE HOY

${newsContext}${trendingBlock}

## INSTRUCCIONES DE ESTILO

${toneInstruction}${relatedBlock}${rhythmBlock}

${greetingBlock}

## ESTRUCTURA NARRATIVA

Tu podcast NO es una lista de noticias. Es una HISTORIA con arco narrativo:

**1. GANCHO (~${introSeconds}s):** Saluda al oyente (ver SALUDO arriba) y engancha inmediatamente con contenido interesante. ${openingStyle}
NO uses "hola, bienvenidos a WaveCast" ni ningún saludo corporativo. El nombre del podcast puede aparecer de forma natural, pero no como saludo formal.

**2. DESARROLLO (${selectedArticles.length} noticias, ~${secondsPerArticle}s cada una):**
- Presenta las noticias en orden de NARRATIVA, no de importancia. Si dos noticias se conectan, van seguidas.
- Cuenta cada noticia como una HISTORIA, no como un titular + análisis.
- Varía la estructura: algunas empiezan con un dato impactante, otras con una pregunta, otras con tu reacción.
- Cita la fuente de forma natural ("según publica [fuente]", "lo contaba [fuente] esta mañana").
- TRANSICIONES: ${transitionStyle}
- Cada transición debe sentirse INEVITABLE, como si una noticia llevara naturalmente a la otra. Nunca uses "Y ahora pasamos a..." ni "En otro orden de cosas...". Encuentra el hilo conector.${surpriseInstruction}

**3. RESPIRO:** Después de 2-3 noticias densas, mete un momento más ligero o una reflexión breve. El oyente necesita respirar. Puede ser una curiosidad, un dato sorprendente, o un "esto me ha hecho pensar en..."

**4. CLÍMAX:** La noticia más profunda o polémica va hacia el final. Dale espacio para análisis. Es la que el oyente se lleva en la cabeza.

**5. CIERRE CON GANCHO (~${closingSeconds}s):** ${closingStyle}
No cierres con un resumen. Deja al oyente pensando.

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
5. Sé humano. Sé real. Sé interesante. Si un trozo suena a "generado por IA", reescríbelo.${antiRepetitionBlock}${profileBlock}${
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
        // Usar streaming para mantener la conexión viva y evitar timeout
        // La API envía tokens progresivamente, finalMessage() espera al resultado completo
        const stream = client.messages.stream(
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

        return await stream.finalMessage();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        if (
          (err instanceof Error && err.name === "AbortError") ||
          msg.includes("aborted") ||
          msg.includes("abort")
        ) {
          throw new Error("La generación del guion ha excedido el tiempo límite. Intenta con una duración más corta.");
        }
        throw err;
      } finally {
        clearTimeout(timeout);
      }
    },
    { maxRetries: 1, baseDelayMs: 3000, maxDelayMs: 10000, label: "claude-generate-script" }
  );

  // Extraer el texto de la respuesta
  const textBlock = message.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No se recibió texto en la respuesta de Claude");
  }

  log.info(`Guion generado: ${textBlock.text.length} caracteres`);
  return textBlock.text;
}
