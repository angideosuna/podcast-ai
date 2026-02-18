// Integración con ElevenLabs para generar audio del podcast

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_VOICE_ID = "pFZP5JQG7iQjIQuC4Bku"; // Lily - voz femenina en español
const MODEL_ID = "eleven_multilingual_v2";
const MAX_CHARS_PER_REQUEST = 5000;

/**
 * Limpia el guion Markdown para que suene natural en TTS.
 * Elimina headers, bold, separadores, anotaciones de tiempo, etc.
 */
export function cleanScriptForTTS(script: string): string {
  return (
    script
      // Eliminar línea de metadatos final (*Duración estimada...*)
      .replace(/^\*Duración estimada:.*\*$/gm, "")
      // Eliminar anotaciones de tiempo [INTRO - 30 segundos], [NOTICIA 1 - 60 segundos], etc.
      .replace(/\[.*?\d+\s*segundos?\]/g, "")
      // Eliminar headers markdown (# ## ###) pero conservar el texto
      .replace(/^#{1,3}\s+/gm, "")
      // Eliminar separadores ---
      .replace(/^---$/gm, "")
      // Eliminar bold **texto** → texto
      .replace(/\*\*(.+?)\*\*/g, "$1")
      // Eliminar italic *texto* → texto
      .replace(/\*(.+?)\*/g, "$1")
      // Eliminar enlaces markdown [texto](url) → texto
      .replace(/\[(.+?)\]\(.+?\)/g, "$1")
      // Eliminar emojis comunes de los títulos
      .replace(
        /[\u{1F3A7}\u{1F399}\u{1F4F0}\u{1F4E1}\u{2705}\u{274C}\u{1F525}\u{1F680}\u{1F4A1}\u{1F4CA}\u{1F3DB}\u{1F3E5}\u{1F3AD}\u{1F4BB}\u{1F916}\u{1F52C}\u{1F4C8}]/gu,
        ""
      )
      // Colapsar múltiples líneas vacías en una sola pausa
      .replace(/\n{3,}/g, "\n\n")
      // Limpiar espacios extra
      .replace(/  +/g, " ")
      .trim()
  );
}

/**
 * Divide el guion en secciones por separadores (---) para respetar
 * el límite de caracteres por petición de ElevenLabs.
 */
function splitScript(cleanedScript: string): string[] {
  // Dividir por dobles saltos de línea (que eran los ---)
  const sections = cleanedScript
    .split(/\n\n+/)
    .filter((s) => s.trim().length > 0);

  // Agrupar secciones para no exceder el límite
  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    if (current.length + section.length + 2 > MAX_CHARS_PER_REQUEST) {
      if (current.trim()) chunks.push(current.trim());
      current = section;
    } else {
      current += (current ? "\n\n" : "") + section;
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

/**
 * Genera audio para un fragmento de texto usando ElevenLabs.
 */
async function generateChunkAudio(
  text: string,
  apiKey: string,
  voiceId: string
): Promise<ArrayBuffer> {
  const response = await fetch(`${ELEVENLABS_API_URL}/${voiceId}`, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.3,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Error de ElevenLabs (${response.status}): ${
        (error as { detail?: { message?: string } }).detail?.message ||
        JSON.stringify(error)
      }`
    );
  }

  return response.arrayBuffer();
}

/**
 * Genera el audio completo del podcast.
 * Para scripts largos, divide en secciones y concatena los buffers.
 */
export async function generateAudio(script: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY no está configurada en las variables de entorno"
    );
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
  const cleanedScript = cleanScriptForTTS(script);

  // Si el texto cabe en una sola petición, generar directamente
  if (cleanedScript.length <= MAX_CHARS_PER_REQUEST) {
    const audioBuffer = await generateChunkAudio(
      cleanedScript,
      apiKey,
      voiceId
    );
    return Buffer.from(audioBuffer);
  }

  // Para textos largos, dividir y concatenar
  const chunks = splitScript(cleanedScript);
  const audioBuffers: ArrayBuffer[] = [];

  for (const chunk of chunks) {
    const buffer = await generateChunkAudio(chunk, apiKey, voiceId);
    audioBuffers.push(buffer);
  }

  // Concatenar todos los buffers de audio
  const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.byteLength, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const buf of audioBuffers) {
    combined.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }

  return Buffer.from(combined);
}
