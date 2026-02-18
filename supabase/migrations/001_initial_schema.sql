-- Esquema inicial de PodCast.ai
-- Ejecutar en Supabase SQL Editor

-- ============================================
-- TABLA: profiles (datos del usuario)
-- ============================================
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  nombre text,
  empresa text,
  rol text,
  sector text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- Crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS: cada usuario solo ve su perfil
alter table public.profiles enable row level security;

create policy "Los usuarios ven su propio perfil"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Los usuarios editan su propio perfil"
  on public.profiles for update
  using (auth.uid() = id);

-- ============================================
-- TABLA: preferences (preferencias del podcast)
-- ============================================
create table public.preferences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null unique,
  topics text[] not null default '{}',
  duration integer not null default 15,
  tone text not null default 'casual',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- RLS: cada usuario solo ve sus preferencias
alter table public.preferences enable row level security;

create policy "Los usuarios ven sus propias preferencias"
  on public.preferences for select
  using (auth.uid() = user_id);

create policy "Los usuarios crean sus propias preferencias"
  on public.preferences for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios editan sus propias preferencias"
  on public.preferences for update
  using (auth.uid() = user_id);

-- ============================================
-- TABLA: episodes (episodios generados)
-- ============================================
create table public.episodes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  script text not null,
  audio_url text,
  duration integer not null,
  tone text not null,
  topics text[] not null default '{}',
  articles jsonb default '[]',
  adjustments text,
  created_at timestamptz default now() not null
);

-- Índice para buscar episodios por usuario y fecha
create index episodes_user_date_idx on public.episodes (user_id, created_at desc);

-- RLS: cada usuario solo ve sus episodios
alter table public.episodes enable row level security;

create policy "Los usuarios ven sus propios episodios"
  on public.episodes for select
  using (auth.uid() = user_id);

create policy "Los usuarios crean sus propios episodios"
  on public.episodes for insert
  with check (auth.uid() = user_id);

create policy "Los usuarios editan sus propios episodios"
  on public.episodes for update
  using (auth.uid() = user_id);

-- ============================================
-- STORAGE: bucket para archivos de audio
-- ============================================
insert into storage.buckets (id, name, public)
values ('podcast-audio', 'podcast-audio', true);

-- Política de storage: usuarios autenticados pueden subir a su carpeta
create policy "Usuarios suben audio a su carpeta"
  on storage.objects for insert
  with check (
    bucket_id = 'podcast-audio'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Política de storage: acceso público de lectura
create policy "Audio accesible públicamente"
  on storage.objects for select
  using (bucket_id = 'podcast-audio');
