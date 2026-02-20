-- Tabla de horarios de generación automática de podcasts
CREATE TABLE schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  time time NOT NULL DEFAULT '08:00',
  frequency text NOT NULL DEFAULT 'weekdays' CHECK (frequency IN ('daily', 'weekdays', 'custom')),
  custom_days integer[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  last_generated_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own schedules" ON schedules FOR ALL USING (auth.uid() = user_id);
