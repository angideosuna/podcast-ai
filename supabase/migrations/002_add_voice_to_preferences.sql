-- Añadir campo voice a la tabla preferences
-- El frontend ya envía y usa este campo, pero no se persistía en Supabase

ALTER TABLE public.preferences
  ADD COLUMN voice text NOT NULL DEFAULT 'female';
