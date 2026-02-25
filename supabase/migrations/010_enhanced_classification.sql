-- Migración 010: Campos mejorados para clasificación enriquecida
ALTER TABLE processed_news ADD COLUMN IF NOT EXISTS sentiment text DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'negative', 'neutral'));
ALTER TABLE processed_news ADD COLUMN IF NOT EXISTS impact_scope text DEFAULT 'national' CHECK (impact_scope IN ('local', 'national', 'global'));
ALTER TABLE processed_news ADD COLUMN IF NOT EXISTS story_id text;

-- Índice para agrupar noticias por story_id
CREATE INDEX IF NOT EXISTS processed_news_story_idx ON processed_news(story_id) WHERE story_id IS NOT NULL;

-- Índice para filtrar por sentiment
CREATE INDEX IF NOT EXISTS processed_news_sentiment_idx ON processed_news(sentiment);
