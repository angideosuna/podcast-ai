// Utilidades compartidas para Text-to-Speech (ElevenLabs y Web Speech API)

/** Abreviaturas comunes en español que deben expandirse la primera vez */
const ABBREVIATIONS: Record<string, string> = {
  "IA": "inteligencia artificial",
  "UE": "Unión Europea",
  "EEUU": "Estados Unidos",
  "CEO": "director ejecutivo",
  "CTO": "director de tecnología",
  "PIB": "producto interior bruto",
  "OMS": "Organización Mundial de la Salud",
  "ONU": "Naciones Unidas",
  "FMI": "Fondo Monetario Internacional",
  "BCE": "Banco Central Europeo",
};

/**
 * Pre-procesa el guion para mejorar la calidad del TTS (ElevenLabs).
 * Expande abreviaturas, añade pausas, limpia URLs y caracteres especiales.
 */
export function preprocessForTTS(script: string): string {
  let processed = script;

  // 1. Expandir abreviaturas comunes (solo la primera ocurrencia)
  for (const [abbr, full] of Object.entries(ABBREVIATIONS)) {
    const regex = new RegExp(`\\b${abbr}\\b`);
    processed = processed.replace(regex, `${full}, ${abbr},`);
  }

  // 2. Convertir números grandes comunes a texto legible
  // "$2.5B" or "2.5B" → "dos mil quinientos millones de dólares"
  processed = processed.replace(/\$?([\d,.]+)\s*B\b/g, (_, num) => {
    const n = parseFloat(num.replace(",", "."));
    return isNaN(n) ? _ : `${n} mil millones de dólares`;
  });
  // "3.500M" or "€3.500M" → "3500 millones"
  processed = processed.replace(/[€$]?([\d,.]+)\s*M\b/g, (_, num) => {
    const n = parseFloat(num.replace(",", "."));
    return isNaN(n) ? _ : `${n} millones`;
  });
  // Percentage: "45%" → "cuarenta y cinco por ciento" (keep as-is, TTS handles well)

  // 3. Añadir pausas naturales después de titulares (ElevenLabs respeta "...")
  processed = processed.replace(/^(#{1,3}.*$)/gm, "$1\n...\n");

  // 4. Limpiar URLs que hayan quedado en el texto
  processed = processed.replace(/https?:\/\/\S+/g, "");

  // 5. Limpiar caracteres especiales que confunden al TTS
  processed = processed.replace(/[*_~`#]/g, "");

  return processed;
}

/**
 * Limpia el guion Markdown para que suene natural en TTS.
 * Elimina headers, bold, separadores, anotaciones de tiempo, emojis, etc.
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
      // Eliminar todos los emojis usando categorías Unicode
      .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "")
      // Colapsar múltiples líneas vacías en una sola pausa
      .replace(/\n{3,}/g, "\n\n")
      // Limpiar espacios extra
      .replace(/  +/g, " ")
      .trim()
  );
}
