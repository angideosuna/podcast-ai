-- Añadir campos de encuesta personal al perfil del usuario
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS edad text,
  ADD COLUMN IF NOT EXISTS ciudad text,
  ADD COLUMN IF NOT EXISTS nivel_conocimiento text,
  ADD COLUMN IF NOT EXISTS objetivo_podcast text,
  ADD COLUMN IF NOT EXISTS horario_escucha text,
  ADD COLUMN IF NOT EXISTS survey_completed boolean NOT NULL DEFAULT false;
