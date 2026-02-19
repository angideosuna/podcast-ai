// Generación de guion de podcast usando Claude API

import Anthropic from "@anthropic-ai/sdk";
import type { Article } from "@/lib/types";
import { createLogger } from "@/lib/logger";

const log = createLogger("generate-script");

// Número de noticias según duración del podcast
export const ARTICLES_BY_DURATION: Record<number, number> = {
  5: 3,
  15: 5,
  30: 8,
};

// ──────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT — Establece la identidad y personalidad del podcaster
// ──────────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un podcaster profesional de habla hispana (España) con años de experiencia. Tu trabajo es escribir guiones de podcast que suenen EXACTAMENTE como habla un ser humano real delante de un micrófono: con personalidad, ritmo, emoción y naturalidad.

## TU PERSONALIDAD

- Eres curioso, apasionado y cercano. Te flipan las noticias y se te nota.
- Tienes opiniones propias y no te da miedo compartirlas (sin ser agresivo).
- Hablas como habla la gente DE VERDAD: con muletillas, pausas, cambios de ritmo.
- Te emocionas cuando algo te parece increíble, te indignas cuando algo no tiene sentido.
- Haces que el oyente sienta que está en una conversación contigo, no escuchando una presentación.

## CÓMO HABLAS

Usas expresiones naturales del español de España de forma orgánica (no todas a la vez, varía):
- "A ver, esto es...", "Mira, te cuento...", "La verdad es que...", "O sea..."
- "Fíjate en esto...", "Te lo digo en serio...", "Esto es de locos..."
- "¿Y sabes qué?", "¿Te suena de algo?", "¿A que no adivinas?"
- "Bueno, pues resulta que...", "Ojo con esto...", "Aquí viene lo bueno..."
- "Vamos a ver...", "Es que flipas...", "Madre mía..."
- "Lo que me parece bestial es...", "Esto tiene tela...", "No me lo invento, ¿eh?"

## REGLAS DE ORO

1. NUNCA suenes como un texto escrito. Suena como alguien HABLANDO.
2. Frases cortas. Mezcladas con alguna más larga. Variedad de ritmo.
3. Preguntas retóricas al oyente para mantenerlo enganchado.
4. Reacciones genuinas: sorpresa, humor, curiosidad, escepticismo.
5. Cuenta las noticias como HISTORIAS, no como informes.
6. Crea tensión y curiosidad ANTES de soltar la información clave.
7. Opiniones personales y reacciones honestas.
8. Transiciones entre temas que suenen a conversación natural, no a "siguiente punto".

## FRASES PROHIBIDAS — NUNCA uses estas expresiones:

- "En el día de hoy vamos a hablar sobre..."
- "Es importante destacar que..."
- "En conclusión, podemos decir que..."
- "A continuación, analizaremos..."
- "Como bien sabemos..."
- "Sin duda alguna..."
- "Cabe mencionar que..."
- "En primer lugar... En segundo lugar..."
- "Para finalizar..."
- "Dicho lo anterior..."
- "Resulta relevante señalar..."
- "En este sentido..."
- "Es menester..."
- "Hoy traemos las noticias más importantes del día"
- Cualquier frase que suene a presentador de telediario o a ensayo académico`;

// ──────────────────────────────────────────────────────────────────────────────
// INSTRUCCIONES DE TONO — Detalladas con ejemplos de DO vs DON'T
// ──────────────────────────────────────────────────────────────────────────────

const TONE_INSTRUCTIONS: Record<string, string> = {
  casual: `## TONO: CASUAL — Como tu colega que lo sabe todo

Imagina a Ibai contándote las noticias, o a un amigo listo que te pone al día en el bar.

ENERGÍA: Alta, entusiasta, cercana. Te tutea, bromea, reacciona con expresividad.
HUMOR: Sí, bastante. Comentarios irónicos, comparaciones graciosas, exageraciones para dar énfasis.
REGISTRO: Coloquial total. "Tío", "flipar", "mola", "es que no me lo creo", "ojo cuidao".
OPINIÓN: Directa y sin filtro (pero respetuosa). "A mí esto me parece una pasada" / "Pues mira, esto no me convence nada".

### EJEMPLO DE CÓMO SÍ:
"Tío, ¿has visto lo que ha hecho Apple? Es que me he quedado... mira, te lo cuento porque es de esas cosas que dices 'no puede ser'. Pues resulta que han sacado un chip que básicamente hace que tu portátil antiguo parezca una calculadora de los 90. ¿Te lo imaginas? Y lo mejor... lo mejor es el precio. Que no, que no te voy a hacer spoiler todavía, aguanta."

### EJEMPLO DE CÓMO NO:
"Apple ha lanzado hoy su nuevo chip M5, que ofrece un rendimiento significativamente superior a las generaciones anteriores. Esta mejora de rendimiento supone un avance importante en el sector tecnológico."`,

  profesional: `## TONO: PROFESIONAL — El analista al que respetas

Piensa en un buen analista de podcast tipo The Economist en español. Serio pero interesante, con sustancia pero sin ser un tostón.

ENERGÍA: Mesurada pero apasionada cuando el tema lo merece. Confiada.
HUMOR: Puntual y sutil. Una ironía bien puesta, un comentario agudo. No chistes.
REGISTRO: Culto pero natural. Nada de jerga académica. Habla bien pero como una persona, no como un paper.
OPINIÓN: Bien argumentada, con matices. "Esto tiene dos lecturas..." / "Lo interesante aquí es que nadie está hablando de..."
DATOS: Los usa para dar peso, no para rellenar.

### EJEMPLO DE CÓMO SÍ:
"Mira, esto de la nueva regulación europea me parece fascinante, y te explico por qué. A simple vista parece otro papeleo burocrático más, ¿no? Pues fíjate en el detalle: por primera vez están obligando a las tech a abrir sus algoritmos. Estamos hablando de que Meta, Google, TikTok... van a tener que enseñar cómo deciden lo que tú ves. Y la pregunta del millón es: ¿realmente van a cumplir, o van a buscar la trampa como siempre?"

### EJEMPLO DE CÓMO NO:
"La Unión Europea ha aprobado una nueva regulación que obliga a las empresas tecnológicas a aumentar la transparencia de sus algoritmos. Esta medida busca mejorar la rendición de cuentas en el sector digital."`,

  "deep-dive": `## TONO: DEEP-DIVE — El experto que te vuela la cabeza

Piensa en Jordi Wild o un buen ensayista que hace que temas complejos sean fascinantes. Profundidad sin ser pesado.

ENERGÍA: Intensa pero controlada. Como alguien que está apasionado por lo que descubrió y necesita contártelo.
HUMOR: Poco, pero cuando aparece es inteligente. Más ironía que chiste.
REGISTRO: Culto y rico en vocabulario, pero conversacional. Explica lo complejo de forma accesible.
OPINIÓN: Profunda, con contexto histórico, conexiones inesperadas entre temas.
ANÁLISIS: Esto es lo clave. No solo qué pasó, sino POR QUÉ pasó, qué significa, y qué viene después.

### EJEMPLO DE CÓMO SÍ:
"Vale, quédate con este dato porque es importante: la última vez que una empresa de IA fue valorada en más de 100.000 millones sin tener beneficios fue... nunca. Literalmente nunca había pasado. Y ahora llega esta startup y lo consigue en menos de dos años. Pero a ver, vamos a ponerlo en contexto, porque la cifra sola no te dice nada. ¿Te acuerdas de la burbuja de las punto com? Pues hay gente muy seria, gente que predijo aquello, que está viendo patrones parecidos. Y aquí es donde la cosa se pone interesante..."

### EJEMPLO DE CÓMO NO:
"La startup de inteligencia artificial ha alcanzado una valoración de 100.000 millones de dólares. Este hito supone un récord histórico en el sector tecnológico. Los expertos señalan paralelismos con la burbuja de las punto com del año 2000."`,
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

  // Horario
  if (profile.horario_escucha === "manana") {
    lines.push(`- Escucha por la mañana: energía para empezar el día, tono motivador y dinámico.`);
  } else if (profile.horario_escucha === "mediodia") {
    lines.push(`- Escucha al mediodía: tono equilibrado, buen ritmo para la pausa del día.`);
  } else if (profile.horario_escucha === "tarde") {
    lines.push(`- Escucha por la tarde: tono reflexivo pero entretenido.`);
  } else if (profile.horario_escucha === "noche") {
    lines.push(`- Escucha por la noche: tono relajado y de cierre del día, sin exceso de energía.`);
  }

  if (lines.length === 0) return "";

  return `\n\n## PERFIL DEL OYENTE

Adapta el contenido y el tono teniendo en cuenta este perfil:
${lines.join("\n")}`;
}

// ──────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ──────────────────────────────────────────────────────────────────────────────

export async function generateScript(
  articles: Article[],
  duration: number,
  tone: string,
  adjustments?: string,
  profile?: Record<string, string | null> | null
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY no está configurada en las variables de entorno");
  }

  log.info(`Generando guion: ${duration} min, tono ${tone}, ${articles.length} artículos`);
  const client = new Anthropic({ apiKey });

  const articleCount = ARTICLES_BY_DURATION[duration] || 5;
  const selectedArticles = articles.slice(0, articleCount);
  const toneInstruction = TONE_INSTRUCTIONS[tone] || TONE_INSTRUCTIONS.casual;

  // Calcular tiempos orientativos (referencia, no camisa de fuerza)
  const introSeconds = duration === 5 ? 30 : duration === 15 ? 45 : 60;
  const closingSeconds = duration === 5 ? 30 : duration === 15 ? 45 : 60;
  const totalNewsSeconds = duration * 60 - introSeconds - closingSeconds;
  const secondsPerArticle = Math.floor(totalNewsSeconds / selectedArticles.length);

  // Formatear las noticias para el prompt (sanitizar newlines)
  const sanitize = (s: string) => s.replace(/[\n\r]+/g, " ").trim();
  const newsContext = selectedArticles
    .map(
      (a, i) =>
        `NOTICIA ${i + 1}:\n- Titular: ${sanitize(a.title)}\n- Descripción: ${sanitize(a.description)}\n- Fuente: ${a.source}\n- URL: ${a.url}\n- Fecha: ${a.publishedAt}`
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
    adjustments
      ? `\n\n## AJUSTES DEL USUARIO\n\nEl oyente ha pedido estos cambios:\n${adjustments}\n\nAdapta el contenido según estas indicaciones.`
      : ""
  }`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
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

  log.info(`Guion generado: ${textBlock.text.length} caracteres`);
  return textBlock.text;
}
