// Renderizado básico de Markdown a HTML para el guion del podcast.
// El contenido viene de Claude pero puede incluir datos de articulos externos,
// asi que se sanitiza HTML antes de procesar Markdown.

/** Escapa caracteres HTML para prevenir XSS */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderMarkdown(md: string): string {
  // Escapar HTML primero, luego aplicar Markdown
  return escapeHtml(md)
    .replace(
      /^### (.+)$/gm,
      '<h3 class="text-lg font-semibold text-forest mt-6 mb-2">$1</h3>'
    )
    .replace(
      /^## (.+)$/gm,
      '<h2 class="text-xl font-bold text-forest mt-8 mb-3">$1</h2>'
    )
    .replace(
      /^# (.+)$/gm,
      '<h1 class="text-2xl font-bold text-forest mt-6 mb-4">$1</h1>'
    )
    .replace(
      /\*\*(.+?)\*\*/g,
      '<strong class="text-forest font-semibold">$1</strong>'
    )
    .replace(/\*(.+?)\*/g, '<em class="text-dark">$1</em>')
    .replace(/^---$/gm, '<hr class="border-cream-dark my-6" />')
    .replace(
      /\n\n/g,
      '</p><p class="text-dark leading-relaxed mb-4">'
    )
    .replace(/^(?!<)/, '<p class="text-dark leading-relaxed mb-4">')
    .concat("</p>");
}
