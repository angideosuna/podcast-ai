-- ============================================
-- News Agent — Tablas para el agente de noticias
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ============================================
-- TABLA: raw_news (noticias sin procesar)
-- ============================================
create table public.raw_news (
  id uuid default gen_random_uuid() primary key,
  source_id text not null,
  source_name text not null,
  source_type text not null,              -- 'rss', 'newsapi'
  title text not null,
  description text,
  content text,
  url text not null unique,               -- URL única para evitar duplicados
  image_url text,
  author text,
  language text not null default 'en',
  category text,
  published_at timestamptz,
  fetched_at timestamptz default now() not null,
  processed boolean default false not null,
  created_at timestamptz default now() not null
);

-- Índices para raw_news
create index raw_news_unprocessed_idx on public.raw_news (processed, fetched_at desc) where not processed;
create index raw_news_source_idx on public.raw_news (source_id);
create index raw_news_fetched_idx on public.raw_news (fetched_at desc);

-- RLS: solo acceso via service_role (el agente es un proceso de servidor)
alter table public.raw_news enable row level security;

-- ============================================
-- TABLA: processed_news (noticias analizadas por IA)
-- ============================================
create table public.processed_news (
  id uuid default gen_random_uuid() primary key,
  raw_news_id uuid references public.raw_news on delete cascade not null,
  title text not null,
  summary text not null,
  category text not null,
  relevance_score integer not null check (relevance_score between 1 and 10),
  language text not null,
  keywords text[] default '{}',
  url text not null,
  source_name text not null,
  published_at timestamptz,
  processed_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

-- Índices para processed_news
create index processed_news_relevance_idx on public.processed_news (relevance_score desc);
create index processed_news_category_idx on public.processed_news (category);
create index processed_news_date_idx on public.processed_news (published_at desc);

-- RLS + política de lectura para la app (genera podcast desde processed_news)
alter table public.processed_news enable row level security;

create policy "Lectura pública de noticias procesadas"
  on public.processed_news for select
  using (true);

-- ============================================
-- TABLA: trending_topics (temas trending con score)
-- ============================================
create table public.trending_topics (
  id uuid default gen_random_uuid() primary key,
  topic text not null,
  score numeric not null default 0,
  article_count integer not null default 0,
  category text,
  date date not null default current_date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(topic, date)
);

-- Índices para trending_topics
create index trending_topics_date_idx on public.trending_topics (date desc);
create index trending_topics_score_idx on public.trending_topics (date, score desc);

-- RLS + política de lectura para la app
alter table public.trending_topics enable row level security;

create policy "Lectura pública de trending topics"
  on public.trending_topics for select
  using (true);

-- ============================================
-- TABLA: sources_health (estado de cada fuente)
-- ============================================
create table public.sources_health (
  id uuid default gen_random_uuid() primary key,
  source_id text not null unique,
  source_name text not null,
  source_type text not null,              -- 'rss', 'newsapi'
  last_fetch_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  consecutive_failures integer not null default 0,
  total_articles_fetched integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS: solo acceso via service_role
alter table public.sources_health enable row level security;

-- ============================================
-- FUNCIONES RPC para operaciones atómicas
-- ============================================

-- Incrementar total_articles_fetched de forma atómica
create or replace function public.increment_articles_fetched(
  p_source_id text,
  p_count integer
)
returns void as $$
begin
  update public.sources_health
  set total_articles_fetched = total_articles_fetched + p_count,
      updated_at = now()
  where source_id = p_source_id;
end;
$$ language plpgsql security definer;

-- Incrementar consecutive_failures de forma atómica
create or replace function public.increment_consecutive_failures(
  p_source_id text
)
returns void as $$
begin
  update public.sources_health
  set consecutive_failures = consecutive_failures + 1,
      updated_at = now()
  where source_id = p_source_id;
end;
$$ language plpgsql security definer;
