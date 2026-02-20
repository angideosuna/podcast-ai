-- Añadir campos de horario detallado al perfil
-- horario_escucha pasa a almacenar la hora exacta (ej: "08:00")
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS periodicidad text,
  ADD COLUMN IF NOT EXISTS dias_personalizados jsonb;
