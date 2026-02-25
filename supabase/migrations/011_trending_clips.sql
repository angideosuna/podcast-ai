-- Tabla para cachear clips trending de 5 minutos (generados on-demand)

CREATE TABLE trending_clips (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  topic text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  script text NOT NULL DEFAULT '',
  articles jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'error')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(topic, date)
);

CREATE INDEX trending_clips_date_idx ON trending_clips(date DESC);
CREATE INDEX trending_clips_lookup_idx ON trending_clips(topic, date);

ALTER TABLE trending_clips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lectura pública de trending clips" ON trending_clips FOR SELECT USING (true);
