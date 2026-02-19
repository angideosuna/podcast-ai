// Renderizado básico de Markdown a HTML para el guion del podcast.
// Nota: Este parser es intencional para el caso de uso específico del guion,
// donde el contenido viene de nuestra propia API (Claude). No se usa con
// contenido arbitrario de usuarios externos.

export function renderMarkdown(md: string): string {
  return md
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-lg font-semibold text-slate-200 mt-6 mb-2">$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-xl font-bold text-white mt-8 mb-3">$1</h2>'
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="text-2xl font-bold text-white mt-6 mb-4">$1</h1>'
    )
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-white font-semibold">$1</strong>'
    )
    .replace(/\*(.+?)\*/g, '<em class="text-slate-300">$1</em>')
    .replace(/^---$/gm, '<hr class="border-slate-800 my-6" />')
    .replace(
      /\n\n/g,
      '</p><p class="text-slate-300 leading-relaxed mb-4">'
    )
    .replace(/^(?!<)/, '<p class="text-slate-300 leading-relaxed mb-4">')
    .concat("</p>");
}
