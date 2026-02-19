// Tipos centralizados del proyecto PodCast.ai

// ============================================
// Artículos de noticias
// ============================================

export interface Article {
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
}

// ============================================
// Episodios
// ============================================

export interface Episode {
  id: string;
  title: string;
  script: string;
  topics: string[];
  duration: number;
  tone: string;
  audio_url: string | null;
  articles: Article[];
  adjustments: string | null;
  created_at: string;
}

/** Versión resumida para listados (sin script ni articles completos) */
export type EpisodeSummary = Pick<
  Episode,
  "id" | "title" | "topics" | "duration" | "tone" | "audio_url" | "created_at"
>;

// ============================================
// Preferencias del usuario
// ============================================

export interface Preferences {
  topics: string[];
  duration: number;
  tone: string;
  voice: string;
  createdAt?: string;
}

// ============================================
// Perfil del usuario
// ============================================

export interface Profile {
  nombre: string | null;
  empresa: string | null;
  rol: string | null;
  sector: string | null;
  email?: string;
}

// ============================================
// Fases de carga del podcast
// ============================================

export type LoadingPhase = "news" | "script" | "done" | "error";

// ============================================
// Constantes de UI compartidas
// ============================================

export const TONE_LABELS: Record<string, string> = {
  casual: "Casual",
  profesional: "Profesional",
  "deep-dive": "Deep-dive",
};

export const VOICE_LABELS: Record<string, string> = {
  female: "Voz femenina",
  male: "Voz masculina",
};
