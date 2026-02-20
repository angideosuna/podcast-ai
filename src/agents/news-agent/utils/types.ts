// Tipos del News Agent

// ============================================
// Raw News — noticias tal cual llegan de las fuentes
// ============================================

export interface RawNewsItem {
  id?: string;
  source_id: string;
  source_name: string;
  source_type: "rss" | "newsapi";
  title: string;
  description: string | null;
  content: string | null;
  url: string;
  image_url: string | null;
  author: string | null;
  language: string;
  category: string | null;
  published_at: string | null;
  fetched_at?: string;
  processed?: boolean;
  created_at?: string;
}

// ============================================
// Processed News — noticias analizadas por IA
// ============================================

export interface ProcessedNewsItem {
  id?: string;
  raw_news_id: string;
  title: string;
  summary: string;
  category: string;
  relevance_score: number; // 1-10
  language: string;
  keywords: string[];
  url: string;
  source_name: string;
  published_at: string | null;
  processed_at?: string;
  created_at?: string;
}

// ============================================
// Trending Topics — temas trending con score
// ============================================

export interface TrendingTopic {
  id?: string;
  topic: string;
  score: number;
  article_count: number;
  category: string | null;
  date: string;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Source Health — estado de cada fuente
// ============================================

export interface SourceHealth {
  id?: string;
  source_id: string;
  source_name: string;
  source_type: string;
  last_fetch_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  consecutive_failures: number;
  total_articles_fetched: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================
// Configuración de fuentes
// ============================================

export interface RSSSourceConfig {
  id: string;
  name: string;
  url: string;
  language: string;
  category: string;
  enabled: boolean;
}

export interface APISourceConfig {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  categories: string[];
}

export interface SourcesConfig {
  rss: RSSSourceConfig[];
  apis: APISourceConfig[];
}

// ============================================
// Configuración general del agente
// ============================================

export interface AgentConfig {
  polling: {
    rss_interval_minutes: number;
    api_interval_minutes: number;
  };
  processing: {
    batch_size: number;
    max_age_hours: number;
  };
  languages: string[];
  categories: string[];
}

// ============================================
// Resultado de un fetch de fuente
// ============================================

export interface FetchResult {
  source_id: string;
  source_name: string;
  items: RawNewsItem[];
  success: boolean;
  error?: string;
  duration_ms: number;
}
