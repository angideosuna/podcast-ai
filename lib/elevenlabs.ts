// Integración con ElevenLabs para generar audio del podcast

import { cleanScriptForTTS, preprocessForTTS } from "@/lib/tts-utils";
import { createLogger } from "@/lib/logger";
import { withRetry } from "@/lib/retry";

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
 * Divide el texto en chunks respetando límites de párrafo y frase.
 * Nunca corta a mitad de frase.
 */
function splitScript(cleanedScript: string): string[] {
  // 1. Dividir por dobles saltos de línea (párrafos)
  const paragraphs = cleanedScript
    .split(/\n\n+/)
    .filter((s) => s.trim().length > 0);

  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    // Si el párrafo cabe en el chunk actual, añadirlo
    if (current.length + paragraph.length + 2 <= MAX_CHARS_PER_REQUEST) {
      current += (current ? "\n\n" : "") + paragraph;
      continue;
    }

    // Si hay contenido acumulado, guardarlo como chunk
    if (current.trim()) {
      chunks.push(current.trim());
      current = "";
    }

    // Si el párrafo cabe solo, usarlo directamente
    if (paragraph.length <= MAX_CHARS_PER_REQUEST) {
      current = paragraph;
      continue;
    }

    // Párrafo demasiado largo: cortar por frases
    const sentences = paragraph.match(/[^.!?]+[.!?]+\s*/g) || [paragraph];
    for (const sentence of sentences) {
      if (current.length + sentence.length <= MAX_CHARS_PER_REQUEST) {
        current += sentence;
      } else {
        if (current.trim()) chunks.push(current.trim());
        current = sentence;
      }
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
 * Calcula el tamaño de un tag ID3v2 si existe al inicio del buffer.
 * Devuelve el número de bytes a saltar, o 0 si no hay tag.
 */
function getID3v2Size(data: Uint8Array): number {
  // ID3v2 header: "ID3" (3 bytes) + version (2 bytes) + flags (1 byte) + size (4 bytes syncsafe)
  if (data.length < 10) return 0;
  if (data[0] !== 0x49 || data[1] !== 0x44 || data[2] !== 0x33) return 0; // "ID3"

  // Syncsafe integer: 4 bytes, 7 bits each
  const size =
    ((data[6] & 0x7f) << 21) |
    ((data[7] & 0x7f) << 14) |
    ((data[8] & 0x7f) << 7) |
    (data[9] & 0x7f);

  return 10 + size; // 10 bytes header + tag body
}

/**
 * Busca el primer frame sync MP3 en el buffer.
 * Frame sync = 0xFF seguido de un byte con los 3 bits altos en 1 (0xE0 mask).
 * Devuelve el offset del primer frame, o 0 si no se encuentra.
 */
function findFirstFrameSync(data: Uint8Array): number {
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i] === 0xff && (data[i + 1] & 0xe0) === 0xe0) {
      return i;
    }
  }
  return 0;
}

/**
 * Elimina el header ID3v2 de un buffer MP3 para evitar glitches al concatenar.
 * Para el primer chunk se mantiene todo intacto.
 */
function stripMP3Header(data: Uint8Array): Uint8Array {
  const id3Size = getID3v2Size(data);
  if (id3Size > 0 && id3Size < data.length) {
    return data.subarray(id3Size);
  }

  // Si no hay ID3, buscar el primer frame sync y empezar desde ahí
  const frameOffset = findFirstFrameSync(data);
  if (frameOffset > 0) {
    return data.subarray(frameOffset);
  }

  return data;
}

/**
 * Genera un buffer de silencio MP3 de ~200ms.
 * Frame MPEG1 Layer 3, 128kbps, 44100Hz, stereo.
 * Cada frame dura ~26ms (1152 samples / 44100Hz), así que 8 frames ≈ 208ms.
 */
function generateSilenceBuffer(): Uint8Array {
  // Un frame MP3 MPEG1 Layer 3, 128kbps, 44100Hz = 417 bytes
  // Frame header: FF FB 90 00 (sync, MPEG1, Layer3, 128kbps, 44100Hz, stereo)
  const FRAME_SIZE = 417;
  const FRAMES = 8; // ~208ms de silencio
  const silence = new Uint8Array(FRAME_SIZE * FRAMES);

  for (let f = 0; f < FRAMES; f++) {
    const offset = f * FRAME_SIZE;
    // Frame header
    silence[offset] = 0xff;
    silence[offset + 1] = 0xfb; // MPEG1, Layer 3, no CRC
    silence[offset + 2] = 0x90; // 128kbps, 44100Hz
    silence[offset + 3] = 0x00; // padding=0, stereo
    // El resto del frame ya es 0x00 (silencio digital)
  }

  return silence;
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
  const cleanedScript = preprocessForTTS(cleanScriptForTTS(script));

  // Si el texto cabe en una sola petición, generar directamente
  if (cleanedScript.length <= MAX_CHARS_PER_REQUEST) {
    const audioBuffer = await withRetry(
      () => generateChunkAudio(cleanedScript, apiKey, voiceId),
      { maxRetries: 2, baseDelayMs: 1500, maxDelayMs: 6000, label: "elevenlabs-single" }
    );
    return Buffer.from(audioBuffer);
  }

  // Para textos largos, dividir y concatenar
  const chunks = splitScript(cleanedScript);
  log.info(`Script dividido en ${chunks.length} fragmentos para TTS`);
  const audioBuffers: Uint8Array[] = [];

  const silenceBuffer = generateSilenceBuffer();

  for (let i = 0; i < chunks.length; i++) {
    const buffer = await withRetry(
      () => generateChunkAudio(chunks[i], apiKey, voiceId),
      { maxRetries: 2, baseDelayMs: 1500, maxDelayMs: 6000, label: `elevenlabs-chunk-${i + 1}` }
    );
    const data = new Uint8Array(buffer);

    if (i === 0) {
      // Primer chunk: mantener intacto (incluye header válido)
      audioBuffers.push(data);
    } else {
      // Insertar silencio entre chunks para transición suave
      audioBuffers.push(silenceBuffer);
      // Chunks posteriores: eliminar ID3 header para evitar glitches
      audioBuffers.push(stripMP3Header(data));
    }
  }

  // Concatenar todos los buffers
  const totalLength = audioBuffers.reduce((acc, buf) => acc + buf.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;

  for (const buf of audioBuffers) {
    combined.set(buf, offset);
    offset += buf.length;
  }

  return Buffer.from(combined);
}
