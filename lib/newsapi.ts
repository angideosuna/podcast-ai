// Integracion con GNews para obtener noticias del dia

export interface Article {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

// Mapeo de topic IDs del onboarding a terminos de busqueda
const TOPIC_SEARCH_TERMS: Record<string, string> = {
  tecnologia: "tecnologia OR technology",
  "inteligencia-artificial": "inteligencia artificial OR AI",
  ciencia: "ciencia OR science",
  politica: "politica OR politics",
  economia: "economia OR finanzas",
  startups: "startups OR emprendimiento",
  salud: "salud OR medicina",
  cultura: "cultura OR entretenimiento",
};

export async function fetchNews(
  topics: string[],
  count: number = 10
): Promise<Article[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    throw new Error("GNEWS_API_KEY no esta configurada en las variables de entorno");
  }

  // Combinar los terminos de busqueda de todos los topics seleccionados
  const searchTerms = topics
    .map((topic) => TOPIC_SEARCH_TERMS[topic])
    .filter(Boolean);

  if (searchTerms.length === 0) {
    throw new Error("No se encontraron terminos de busqueda para los topics seleccionados");
  }

  // GNews limita a 10 resultados en plan gratis
  const maxResults = Math.min(count, 10);
  const query = searchTerms.join(" OR ");

  const params = new URLSearchParams({
    q: query,
    lang: "es",
    max: String(maxResults),
    apikey: apiKey,
  });

  const response = await fetch(
    `https://gnews.io/api/v4/search?${params.toString()}`
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `Error de GNews (${response.status}): ${(error as { errors?: string[] }).errors?.[0] || "Error desconocido"}`
    );
  }

  const data = await response.json();

  if (!data.articles || data.articles.length === 0) {
    throw new Error("No se encontraron noticias para los temas seleccionados");
  }

  // Mapear al formato tipado
  return data.articles
    .filter(
      (a: { title: string; description: string }) =>
        a.title && a.description
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
