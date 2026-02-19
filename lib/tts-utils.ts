// Utilidades compartidas para Text-to-Speech (ElevenLabs y Web Speech API)

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
