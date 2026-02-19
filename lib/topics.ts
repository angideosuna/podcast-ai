// Datos de temas disponibles para el onboarding

export interface Topic {
  id: string;
  nombre: string;
  descripcion: string;
  emoji: string;
}

export const TOPICS: Topic[] = [
  {
    id: "tecnologia",
    nombre: "Tecnología",
    descripcion: "Últimas novedades en tech, gadgets y software",
    emoji: "💻",
  },
  {
    id: "inteligencia-artificial",
    nombre: "Inteligencia Artificial",
    descripcion: "Avances en IA, machine learning y automatización",
    emoji: "🤖",
  },
  {
    id: "ciencia",
    nombre: "Ciencia",
    descripcion: "Descubrimientos, investigación y exploración espacial",
    emoji: "🔬",
  },
  {
    id: "politica",
    nombre: "Política",
    descripcion: "Noticias políticas nacionales e internacionales",
    emoji: "🏛️",
  },
  {
    id: "economia",
    nombre: "Economía",
    descripcion: "Mercados, finanzas y tendencias económicas",
    emoji: "📈",
  },
  {
    id: "startups",
    nombre: "Startups",
    descripcion: "Emprendimiento, inversión y ecosistema startup",
    emoji: "🚀",
  },
  {
    id: "salud",
    nombre: "Salud",
    descripcion: "Bienestar, medicina y vida saludable",
    emoji: "🏥",
  },
  {
    id: "cultura",
    nombre: "Cultura",
    descripcion: "Arte, entretenimiento, libros y tendencias",
    emoji: "🎭",
  },
];

export const MIN_TOPICS = 3;
export const MAX_TOPICS = 5;

export const TOPICS_MAP = new Map(TOPICS.map((t) => [t.id, t]));

export function getTopicById(id: string): Topic | undefined {
  return TOPICS_MAP.get(id);
}
