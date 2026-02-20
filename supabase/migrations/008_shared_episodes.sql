-- Migración: Compartir episodios públicamente
-- Añade campos para marcar episodios como compartidos

-- Columnas de sharing en episodes
alter table public.episodes
  add column is_shared boolean default false not null,
  add column shared_at timestamptz;

-- Índice para buscar episodios compartidos por ID rápidamente
create index episodes_shared_idx on public.episodes (id) where is_shared = true;

-- Política RLS: cualquiera puede ver episodios compartidos (sin auth)
create policy "Episodios compartidos son públicos"
  on public.episodes for select
  using (is_shared = true);
