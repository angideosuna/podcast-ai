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
      // Eliminar todos los emojis usando categorías Unicode
      .replace(/\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu, "")
      // Colapsar múltiples líneas vacías en una sola pausa
      .replace(/\n{3,}/g, "\n\n")
      // Limpiar espacios extra
      .replace(/  +/g, " ")
      .trim()
  );
}
