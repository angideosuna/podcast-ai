// Datos de categorías y subtemas para el onboarding

export interface Subtopic {
  id: string;
  nombre: string;
}

export interface Category {
  id: string;
  nombre: string;
  emoji: string;
  subtopics: Subtopic[];
}

export interface TopicDisplay {
  id: string;
  nombre: string;
  emoji: string;
  categoryId: string;
}

export const CATEGORIES: Category[] = [
  {
    id: "tecnologia",
    nombre: "Tecnología",
    emoji: "💻",
    subtopics: [
      { id: "ia", nombre: "Inteligencia Artificial" },
      { id: "ciberseguridad", nombre: "Ciberseguridad" },
      { id: "startups", nombre: "Startups" },
      { id: "gadgets", nombre: "Gadgets" },
      { id: "programacion", nombre: "Programación" },
    ],
  },
  {
    id: "ciencia",
    nombre: "Ciencia",
    emoji: "🔬",
    subtopics: [
      { id: "espacio", nombre: "Espacio" },
      { id: "naturaleza-medioambiente", nombre: "Naturaleza y Medioambiente" },
      { id: "neurociencia", nombre: "Neurociencia" },
      { id: "medicina", nombre: "Medicina" },
    ],
  },
  {
    id: "negocios-finanzas",
    nombre: "Negocios y Finanzas",
    emoji: "📈",
    subtopics: [
      { id: "emprendimiento", nombre: "Emprendimiento" },
      { id: "marketing", nombre: "Marketing" },
      { id: "inversiones", nombre: "Inversiones" },
      { id: "economia", nombre: "Economía" },
    ],
  },
  {
    id: "entretenimiento",
    nombre: "Entretenimiento",
    emoji: "🎬",
    subtopics: [
      { id: "cine-series", nombre: "Cine y Series" },
      { id: "videojuegos", nombre: "Videojuegos" },
      { id: "musica", nombre: "Música" },
      { id: "comedia", nombre: "Comedia" },
    ],
  },
  {
    id: "salud-bienestar",
    nombre: "Salud y Bienestar",
    emoji: "🏥",
    subtopics: [
      { id: "fitness", nombre: "Fitness" },
      { id: "nutricion", nombre: "Nutrición" },
      { id: "salud-mental", nombre: "Salud Mental" },
      { id: "desarrollo-personal", nombre: "Desarrollo Personal" },
    ],
  },
  {
    id: "sociedad-cultura",
    nombre: "Sociedad y Cultura",
    emoji: "🏛️",
    subtopics: [
      { id: "politica-actualidad", nombre: "Política y Actualidad" },
      { id: "historia", nombre: "Historia" },
      { id: "filosofia", nombre: "Filosofía" },
      { id: "educacion", nombre: "Educación" },
    ],
  },
  {
    id: "true-crime-misterio",
    nombre: "True Crime y Misterio",
    emoji: "🔍",
    subtopics: [
      { id: "casos-reales", nombre: "Casos Reales" },
      { id: "paranormal", nombre: "Paranormal" },
      { id: "conspiraciones", nombre: "Conspiraciones" },
      { id: "criminologia", nombre: "Criminología" },
    ],
  },
  {
    id: "lifestyle",
    nombre: "Lifestyle",
    emoji: "✈️",
    subtopics: [
      { id: "viajes", nombre: "Viajes" },
      { id: "gastronomia", nombre: "Gastronomía" },
      { id: "deportes", nombre: "Deportes" },
      { id: "relaciones-familia", nombre: "Relaciones y Familia" },
    ],
  },
];

/** Set con todos los subtopic IDs para validación rápida */
export const ALL_SUBTOPIC_IDS: Set<string> = new Set(
  CATEGORIES.flatMap((c) => c.subtopics.map((s) => s.id))
);

/** Mapeo de subtopic IDs del usuario a categorías del News Agent (processed_news) */
export const TOPIC_TO_CATEGORIES: Record<string, string[]> = {
  // Tecnología
  ia: ["technology", "science"],
  ciberseguridad: ["technology"],
  startups: ["business", "technology"],
  gadgets: ["technology"],
  programacion: ["technology"],
  // Ciencia
  espacio: ["science"],
  "naturaleza-medioambiente": ["science"],
  neurociencia: ["science", "health"],
  medicina: ["science", "health"],
  // Negocios y Finanzas
  emprendimiento: ["business"],
  marketing: ["business"],
  inversiones: ["business"],
  economia: ["business"],
  // Entretenimiento
  "cine-series": ["entertainment"],
  videojuegos: ["entertainment", "technology"],
  musica: ["entertainment"],
  comedia: ["entertainment"],
  // Salud y Bienestar
  fitness: ["health"],
  nutricion: ["health"],
  "salud-mental": ["health"],
  "desarrollo-personal": ["health"],
  // Sociedad y Cultura
  "politica-actualidad": ["politics"],
  historia: ["entertainment"],
  filosofia: ["entertainment"],
  educacion: ["science"],
  // True Crime y Misterio
  "casos-reales": ["entertainment"],
  paranormal: ["entertainment"],
  conspiraciones: ["entertainment"],
  criminologia: ["entertainment"],
  // Lifestyle
  viajes: ["entertainment"],
  gastronomia: ["entertainment"],
  deportes: ["sports", "entertainment"],
  "relaciones-familia": ["health"],
};

// Mapa interno para búsquedas rápidas
const SUBTOPIC_MAP = new Map<string, TopicDisplay>();
for (const cat of CATEGORIES) {
  for (const sub of cat.subtopics) {
    SUBTOPIC_MAP.set(sub.id, {
      id: sub.id,
      nombre: sub.nombre,
      emoji: cat.emoji,
      categoryId: cat.id,
    });
  }
}

// Legacy: mapeo de IDs antiguos a subtopic equivalentes
const LEGACY_ID_MAP: Record<string, string> = {
  tecnologia: "ia",
  "inteligencia-artificial": "ia",
  ciencia: "espacio",
  politica: "politica-actualidad",
  economia: "economia",
  startups: "startups",
  salud: "fitness",
  cultura: "cine-series",
};

/**
 * Busca un topic por ID. Soporta:
 * 1. Subtopic IDs nuevos (ia, ciberseguridad, etc.)
 * 2. Topics custom: con prefijo "custom:"
 * 3. Legacy IDs (tecnologia, inteligencia-artificial, etc.)
 */
export function getTopicById(id: string): TopicDisplay | undefined {
  // 1. Subtopic directo
  const direct = SUBTOPIC_MAP.get(id);
  if (direct) return direct;

  // 2. Custom topic
  if (id.startsWith("custom:")) {
    const label = id.slice(7);
    return {
      id,
      nombre: label,
      emoji: "✏️",
      categoryId: "custom",
    };
  }

  // 3. Legacy fallback
  const mappedId = LEGACY_ID_MAP[id];
  if (mappedId) {
    const mapped = SUBTOPIC_MAP.get(mappedId);
    if (mapped) {
      return { ...mapped, id }; // Devolver con el ID original para consistencia
    }
  }

  return undefined;
}

/** Devuelve los IDs de subtemas de una categoría */
export function getSubtopicsByCategory(categoryId: string): string[] {
  const cat = CATEGORIES.find((c) => c.id === categoryId);
  return cat ? cat.subtopics.map((s) => s.id) : [];
}
