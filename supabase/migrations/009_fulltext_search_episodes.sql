-- Full-text search en episodios (título + script)
-- Usa tsvector con configuración 'spanish' para stemming en castellano.

-- 1. Añadir columna de búsqueda generada automáticamente
alter table public.episodes
  add column if not exists search_vector tsvector
  generated always as (
    setweight(to_tsvector('spanish', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('spanish', coalesce(script, '')), 'B')
  ) stored;

-- 2. Crear índice GIN para búsquedas rápidas
create index if not exists episodes_search_idx
  on public.episodes using gin (search_vector);

-- 3. Función RPC para buscar episodios con ranking de relevancia.
--    Usa plainto_tsquery para queries de usuario (no requiere sintaxis especial).
create or replace function public.search_episodes(
  p_user_id uuid,
  p_query text,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  id uuid,
  title text,
  topics text[],
  duration integer,
  tone text,
  audio_url text,
  created_at timestamptz,
  rank real
)
language sql
stable
security definer
as $$
  select
    e.id,
    e.title,
    e.topics,
    e.duration,
    e.tone,
    e.audio_url,
    e.created_at,
    ts_rank(e.search_vector, plainto_tsquery('spanish', p_query)) as rank
  from public.episodes e
  where e.user_id = p_user_id
    and e.search_vector @@ plainto_tsquery('spanish', p_query)
  order by rank desc, e.created_at desc
  limit p_limit
  offset p_offset;
$$;
