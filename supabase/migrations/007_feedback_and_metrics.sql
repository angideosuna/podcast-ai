-- Feedback explícito del usuario
CREATE TABLE episode_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES episodes ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating IN (1, 5)),
  tags text[] DEFAULT '{}',
  comment text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(episode_id, user_id)
);

-- Métricas de escucha pasivas
CREATE TABLE listening_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id uuid REFERENCES episodes ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  total_listen_time_seconds integer DEFAULT 0,
  completion_rate numeric DEFAULT 0,
  playback_speed numeric DEFAULT 1.0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(episode_id, user_id)
);

ALTER TABLE episode_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE listening_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback" ON episode_feedback FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users manage own metrics" ON listening_metrics FOR ALL USING (auth.uid() = user_id);

CREATE INDEX episode_feedback_user_idx ON episode_feedback(user_id, created_at DESC);
CREATE INDEX listening_metrics_user_idx ON listening_metrics(user_id);
