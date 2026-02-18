// Integración con NewsAPI para obtener noticias del día

export interface Article {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

// Mapeo de topic IDs del onboarding a términos de búsqueda
const TOPIC_SEARCH_TERMS: Record<string, string> = {
  tecnologia: "tecnología OR technology",
  "inteligencia-artificial": "inteligencia artificial OR AI OR artificial intelligence",
  ciencia: "ciencia OR science",
  politica: "política OR politics",
  economia: "economía OR economy OR finanzas",
  startups: "startups OR emprendimiento OR venture capital",
  salud: "salud OR health OR medicina",
  cultura: "cultura OR entertainment OR arte",
};

export async function fetchNews(
  topics: string[],
  count: number = 10
): Promise<Article[]> {
  const apiKey = process.env.NEWSAPI_KEY;
  if (!apiKey) {
    throw new Error("NEWSAPI_KEY no está configurada en las variables de entorno");
  }

  // Combinar los términos de búsqueda de todos los topics seleccionados
  const searchTerms = topics
    .map((topic) => TOPIC_SEARCH_TERMS[topic])
    .filter(Boolean);

  if (searchTerms.length === 0) {
    throw new Error("No se encontraron términos de búsqueda para los topics seleccionados");
  }

  const query = searchTerms.join(" OR ");

  const params = new URLSearchParams({
    q: query,
    sortBy: "publishedAt",
    language: "es",
    pageSize: String(count),
    apiKey,
  });

  const response = await fetch(
    `https://newsapi.org/v2/everything?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Error de NewsAPI (${response.status}): ${error.message || "Error desconocido"}`
    );
  }

  const data = await response.json();

  if (!data.articles || data.articles.length === 0) {
    throw new Error("No se encontraron noticias para los temas seleccionados");
  }

  // Mapear al formato tipado y filtrar artículos sin contenido útil
  return data.articles
    .filter(
      (a: { title: string; description: string }) =>
        a.title && a.description && a.title !== "[Removed]"
    )
    .map(
      (a: {
        title: string;
        description: string;
        source: { name: string };
        url: string;
        publishedAt: string;
      }) => ({
        title: a.title,
        description: a.description,
        source: a.source?.name || "Fuente desconocida",
        url: a.url,
        publishedAt: a.publishedAt,
      })
    );
}
