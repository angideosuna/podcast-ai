// Integracion con GNews para obtener noticias del dia

import { createLogger } from "@/lib/logger";
import type { Article } from "@/lib/types";

export type { Article };

const log = createLogger("newsapi");

// Mapeo de subtopic IDs del onboarding a terminos de busqueda
const TOPIC_SEARCH_TERMS: Record<string, string> = {
  // Tecnología
  ia: "inteligencia artificial OR AI OR machine learning",
  ciberseguridad: "ciberseguridad OR cybersecurity OR hacking",
  startups: "startups OR emprendimiento OR venture capital",
  gadgets: "gadgets OR dispositivos OR tecnologia",
  programacion: "programacion OR software OR desarrollo",
  // Ciencia
  espacio: "espacio OR NASA OR astronomia",
  "naturaleza-medioambiente": "medioambiente OR cambio climatico OR ecologia",
  neurociencia: "neurociencia OR cerebro OR neurologia",
  medicina: "medicina OR salud OR investigacion medica",
  // Negocios y Finanzas
  emprendimiento: "emprendimiento OR negocio OR entrepreneurship",
  marketing: "marketing OR publicidad OR branding",
  inversiones: "inversiones OR bolsa OR finanzas",
  economia: "economia OR mercados OR macroeconomia",
  // Entretenimiento
  "cine-series": "cine OR series OR peliculas OR streaming",
  videojuegos: "videojuegos OR gaming OR esports",
  musica: "musica OR conciertos OR artistas",
  comedia: "comedia OR humor OR stand-up",
  // Salud y Bienestar
  fitness: "fitness OR ejercicio OR deporte",
  nutricion: "nutricion OR dieta OR alimentacion",
  "salud-mental": "salud mental OR psicologia OR bienestar",
  "desarrollo-personal": "desarrollo personal OR productividad OR autoayuda",
  // Sociedad y Cultura
  "politica-actualidad": "politica OR actualidad OR gobierno",
  historia: "historia OR historico OR arqueologia",
  filosofia: "filosofia OR pensamiento OR etica",
  educacion: "educacion OR universidad OR aprendizaje",
  // True Crime y Misterio
  "casos-reales": "true crime OR casos reales OR crimen",
  paranormal: "paranormal OR misterio OR sobrenatural",
  conspiraciones: "conspiraciones OR teorias OR misterios",
  criminologia: "criminologia OR forense OR investigacion criminal",
  // Lifestyle
  viajes: "viajes OR turismo OR destinos",
  gastronomia: "gastronomia OR cocina OR restaurantes",
  deportes: "deportes OR futbol OR competicion",
  "relaciones-familia": "relaciones OR familia OR pareja",
};

export async function fetchNews(
  topics: string[],
  count: number = 10
): Promise<Article[]> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    throw new Error("GNEWS_API_KEY no está configurada en las variables de entorno");
  }

  log.info(`Buscando noticias para topics: ${topics.join(", ")}`);

  // Combinar los terminos de busqueda de todos los topics seleccionados
  const searchTerms = topics.map((topic) => {
    // Soporte para topics custom: usar el label como query directa
    if (topic.startsWith("custom:")) {
      return topic.slice(7);
    }
    return TOPIC_SEARCH_TERMS[topic];
  }).filter(Boolean);

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

  log.info(`GNews devolvió ${data.articles.length} artículos`);

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
