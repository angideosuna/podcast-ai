// Integración con ElevenLabs para generar audio del podcast

import { cleanScriptForTTS } from "@/lib/tts-utils";
import { createLogger } from "@/lib/logger";

const log = createLogger("elevenlabs");
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
// Voces por género (con acento castellano usando eleven_multilingual_v2)
const VOICE_IDS: Record<string, string> = {
  female: "pFZP5JQG7iQjIQuC4Bku", // Lily - voz femenina
  male: "onwK4e9ZLuTAKqWW03F9",   // Daniel - voz masculina
};
const DEFAULT_VOICE_ID = VOICE_IDS.female;
const MODEL_ID = "eleven_multilingual_v2";
const MAX_CHARS_PER_REQUEST = 5000;

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
      language_code: "es",
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
export async function generateAudio(script: string, voice?: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY no está configurada en las variables de entorno"
    );
  }

  // Seleccionar voz según preferencia del usuario
  const voiceId = process.env.ELEVENLABS_VOICE_ID || (voice && VOICE_IDS[voice]) || DEFAULT_VOICE_ID;
  log.info(`Generando audio con voz ${voice || "default"} (ID: ${voiceId})`);
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
  log.info(`Script dividido en ${chunks.length} fragmentos para TTS`);
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
