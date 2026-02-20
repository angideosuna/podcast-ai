# PodCast.ai

> Genera podcasts diarios personalizados con noticias reales y voces AI.

---

## Indice

- [1. Nombre y descripcion](#1-nombre-y-descripcion)
- [2. Stack tecnologico](#2-stack-tecnologico)
- [3. Arquitectura](#3-arquitectura)
- [4. Servicios externos](#4-servicios-externos)
- [5. Base de datos](#5-base-de-datos)
- [6. Variables de entorno](#6-variables-de-entorno)
- [7. Agente de noticias](#7-agente-de-noticias)
- [8. Frontend / Web](#8-frontend--web)
- [9. Despliegue](#9-despliegue)
- [10. Comandos utiles](#10-comandos-utiles)
- [11. Estado actual del proyecto](#11-estado-actual-del-proyecto)
- [12. Costes](#12-costes)

---

## 1. Nombre y descripcion

**Nombre:** PodCast.ai

**En una frase:** Aplicacion web que genera podcasts diarios hiperpersonalizados con noticias reales del dia y voces AI.

**Flujo completo:**

1. Un **News Agent** autonomo recopila noticias de 9 fuentes (8 feeds RSS + NewsAPI.org) y las guarda en bruto en Supabase.
2. El agente **deduplica** las noticias por similitud de titulo (>70% overlap de palabras) y las **clasifica con Claude** (categoria, relevancia 1-10, resumen, keywords).
3. El usuario se registra, completa una **encuesta personal** (nombre, nivel de conocimiento, objetivo, horario) y configura sus **preferencias** (temas, duracion, tono, voz).
4. Al generar un podcast, la app consulta las noticias clasificadas del agente (o GNews como fallback), y **Claude genera un guion** en formato storytelling adaptado al perfil del oyente.
5. El guion se puede escuchar con **Web Speech API** (gratis, navegador) o convertir a audio con **ElevenLabs** (voz profesional).
6. Los episodios se guardan en Supabase y el usuario puede consultarlos en su **historial**.

---

## 2. Stack tecnologico

| Capa | Tecnologia | Version | Para que se usa |
|------|-----------|---------|-----------------|
| Lenguaje | TypeScript | ^5 | Todo el proyecto |
| Framework | Next.js (App Router) | 16.1.6 | SSR, API routes, routing |
| Runtime | React | 19.2.3 | UI del frontend |
| CSS | Tailwind CSS | ^4 | Estilos utility-first |
| Componentes UI | shadcn/ui (Radix UI) | 1.4.3 | Dialog, Button, Card, etc. |
| Iconos | Lucide React | 0.574.0 | Iconos SVG |
| Base de datos | Supabase (PostgreSQL) | SDK 2.97.0 | DB, Auth, Storage |
| Auth | Supabase Auth | @supabase/ssr 0.8.0 | Login, registro, sesiones |
| IA / Guiones | Anthropic SDK (Claude) | 0.76.0 | Generacion de guiones y clasificacion |
| Audio / TTS | ElevenLabs API | eleven_multilingual_v2 | Voz profesional (opcional) |
| Audio / Fallback | Web Speech API | Nativa del navegador | TTS gratis sin API key |
| RSS | rss-parser | 3.13.0 | Parseo de feeds RSS/Atom |
| CLI runner | tsx | 4.21.0 | Ejecutar scripts TS del agente |
| Env | dotenv | 17.3.1 | Variables de entorno en scripts CLI |
| Bundler | Webpack (via Next.js) | - | `next dev --webpack` |

---

## 3. Arquitectura

### 3.1 Estructura de carpetas

```
podcast-ai/
├── app/                              # Next.js App Router
│   ├── layout.tsx                    # Layout raiz (Inter font, bg-stone-100)
│   ├── page.tsx                      # Redirect / → /onboarding
│   ├── globals.css                   # Tailwind + shadcn theme (oklch stone)
│   ├── error.tsx                     # Error boundary global
│   ├── not-found.tsx                 # Pagina 404
│   ├── login/page.tsx                # Login con email/password
│   ├── signup/page.tsx               # Registro con confirmacion por email
│   ├── perfil/page.tsx               # Editar perfil del usuario
│   ├── onboarding/
│   │   ├── page.tsx                  # Onboarding 3 pasos (encuesta + temas + config)
│   │   └── confirmacion/page.tsx     # Confirmacion de preferencias → genera podcast
│   ├── podcast/page.tsx              # Pagina principal de generacion de podcast
│   ├── auth/callback/route.ts        # Callback de confirmacion de email
│   ├── api/
│   │   ├── generate-podcast/route.ts # POST: genera guion con Claude
│   │   ├── generate-audio/route.ts   # POST: genera audio con ElevenLabs
│   │   ├── preferences/route.ts      # GET/POST: preferencias del usuario
│   │   └── profile/route.ts          # GET/POST: perfil del usuario
│   └── (authenticated)/
│       ├── layout.tsx                # Layout con NavHeader
│       ├── dashboard/page.tsx        # Dashboard principal
│       ├── historial/page.tsx        # Lista de episodios
│       └── historial/[id]/page.tsx   # Detalle de un episodio
├── components/
│   ├── nav-header.tsx                # Barra de navegacion (desktop + mobile)
│   ├── topic-card.tsx                # Card de seleccion de tema
│   ├── duration-picker.tsx           # Selector de duracion (5/15/30 min)
│   ├── tone-picker.tsx               # Selector de tono (casual/profesional/deep-dive)
│   ├── voice-picker.tsx              # Selector de voz (femenina/masculina)
│   ├── option-picker.tsx             # Picker generico para encuesta
│   ├── audio-player.tsx              # Reproductor de audio (ElevenLabs MP3)
│   ├── browser-audio-player.tsx      # Reproductor Web Speech API (fallback)
│   ├── adjust-episode.tsx            # Dialog para ajustar/regenerar episodio
│   └── ui/                           # Componentes shadcn/ui
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── separator.tsx
│       └── skeleton.tsx
├── lib/
│   ├── generate-script.ts            # Generacion de guiones con Claude + ARTICLES_BY_DURATION
│   ├── elevenlabs.ts                 # TTS con ElevenLabs (chunking, voice selection)
│   ├── tts-utils.ts                  # Limpieza de guion para TTS (regex Unicode emojis)
│   ├── newsapi.ts                    # Cliente GNews API (fallback)
│   ├── markdown.ts                   # Renderizado Markdown → HTML (tema claro)
│   ├── topics.ts                     # 8 temas + TOPICS_MAP + getTopicById()
│   ├── types.ts                      # Tipos centralizados (Article, Episode, Preferences, Profile)
│   ├── logger.ts                     # Logger con contexto y colores
│   ├── auth-utils.ts                 # Utilidad logout()
│   ├── utils.ts                      # cn() para clases CSS (clsx + tailwind-merge)
│   └── supabase/
│       ├── client.ts                 # Supabase browser client (anon key)
│       └── server.ts                 # Supabase server client (cookies, SSR)
├── src/
│   └── agents/
│       └── news-agent/
│           ├── index.ts              # Clase NewsAgent (fetchAll, processAll, getTopNews)
│           ├── config/
│           │   ├── agent-config.json # Intervalos, batch size, categorias
│           │   └── sources.json      # 8 feeds RSS + 1 API habilitados
│           ├── sources/
│           │   ├── index.ts          # Orquesta todos los fetchers
│           │   ├── rss.ts            # Parser RSS/Atom generico (Promise.allSettled)
│           │   └── newsapi.ts        # Integracion NewsAPI.org (6 categorias + es)
│           ├── processors/
│           │   ├── index.ts          # Pipeline: dedup → clasificar → guardar
│           │   ├── classifier.ts     # Clasificacion con Claude (batches de 10)
│           │   └── deduplicator.ts   # Dedup por similitud de titulo (>70%)
│           ├── storage/
│           │   ├── supabase.ts       # CRUD con service_role (batch upsert)
│           │   └── get-articles.ts   # fetchFromAgent() — bridge agente → podcast
│           ├── scripts/
│           │   ├── fetch.ts          # CLI: npm run agent:fetch
│           │   ├── process.ts        # CLI: npm run agent:process
│           │   └── top.ts            # CLI: npm run agent:top [fecha]
│           └── utils/
│               ├── types.ts          # Tipos del agente
│               └── env.ts            # Carga .env.local para scripts CLI
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # profiles, preferences, episodes, storage
│       ├── 002_add_voice_to_preferences.sql
│       ├── 003_add_survey_fields.sql # edad, ciudad, nivel, objetivo, horario
│       └── 004_news_agent_tables.sql # raw_news, processed_news, trending_topics, sources_health
├── proxy.ts                          # Middleware: refresh sesion + proteger rutas
├── package.json
├── tsconfig.json
├── next.config.ts                    # Permite imagenes de *.supabase.co
├── components.json                   # Config de shadcn/ui
├── postcss.config.mjs
└── eslint.config.mjs
```

### 3.2 Flujo de datos

```
┌─────────────────────────────────────────────────────────┐
│                    NEWS AGENT (CLI)                       │
│                                                           │
│  8 RSS feeds ──┐                                         │
│                ├──→ raw_news (Supabase) ──→ dedup ──→ Claude clasifica ──→ processed_news │
│  NewsAPI.org ──┘                                         │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    WEB APP (Next.js)                      │
│                                                           │
│  Usuario ──→ Onboarding (encuesta + temas + config)      │
│          ──→ POST /api/generate-podcast                  │
│                 ├──→ fetchFromAgent(processed_news)       │
│                 ├──→ fallback: GNews API                  │
│                 ├──→ Claude genera guion personalizado     │
│                 └──→ Guarda episodio en Supabase          │
│          ──→ POST /api/generate-audio                    │
│                 ├──→ ElevenLabs TTS                       │
│                 └──→ Sube MP3 a Supabase Storage          │
│          ──→ Escucha con Web Speech API (alternativa)     │
└─────────────────────────────────────────────────────────┘
```

---

## 4. Servicios externos

### 4.1 Supabase — Base de datos, Auth y Storage

| Campo | Valor |
|-------|-------|
| Para que se usa | PostgreSQL (datos), autenticacion (email/password), almacenamiento (audio MP3) |
| Dashboard | https://supabase.com/dashboard |
| API keys | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Tier | **Gratis** (500 MB DB, 1 GB storage, 50k MAU auth) |
| Estado | Funcionando |

**Detalles:**
- La app web usa el **anon key** + RLS (Row Level Security) para todas las operaciones del usuario
- El News Agent usa el **service_role key** para acceso directo a raw_news, processed_news y sources_health
- Bucket `podcast-audio` es publico para lectura, cada usuario sube a su carpeta `{user_id}/`
- Trigger `on_auth_user_created` crea automaticamente un perfil vacio al registrar usuario

### 4.2 Anthropic (Claude) — Generacion de guiones y clasificacion

| Campo | Valor |
|-------|-------|
| Para que se usa | 1) Generar guiones de podcast personalizados 2) Clasificar noticias en el News Agent |
| Dashboard | https://console.anthropic.com |
| API keys | `ANTHROPIC_API_KEY` |
| Modelo | `claude-sonnet-4-20250514` |
| Tier | **De pago** (por tokens consumidos) |
| Estado | Funcionando |

**Uso en generacion de guiones (`lib/generate-script.ts`):**
- System prompt con personalidad de podcaster (identidad, expresiones, reglas de oro)
- Prompt con noticias, instrucciones de tono detalladas (con ejemplos DO/DON'T), variaciones aleatorias
- Si el usuario tiene perfil, inyecta bloque `PERFIL DEL OYENTE` (nombre, nivel, objetivo, horario)
- `max_tokens`: 4000 (podcast 5min), 8000 (15min), 12000 (30min)
- `temperature`: 0.9

**Uso en clasificacion (`src/agents/news-agent/processors/classifier.ts`):**
- Batches de 10 articulos → Claude asigna categoria, relevancia 1-10, resumen, keywords
- `max_tokens`: 2048 por batch
- `temperature`: 0.3
- 1 reintento con 3s de backoff si el batch falla

### 4.3 ElevenLabs — Text-to-Speech

| Campo | Valor |
|-------|-------|
| Para que se usa | Generar audio MP3 con voces profesionales en espanol |
| Dashboard | https://elevenlabs.io |
| API keys | `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` (opcional) |
| Modelo | `eleven_multilingual_v2` |
| Voces | `pFZP5JQG7iQjIQuC4Bku` (Lily, femenina), `onwK4e9ZLuTAKqWW03F9` (Daniel, masculina) |
| Tier | **De pago** (10k chars gratis/mes, despues pago) |
| Estado | Funcionando (opcional, hay fallback a Web Speech API) |

**Detalles:**
- Limite por peticion: 5000 caracteres. Si el guion es mas largo, se divide en chunks
- Voice settings: stability 0.5, similarity_boost 0.75, style 0.3, speaker_boost true
- El audio se sube a Supabase Storage y se enlaza al episodio
- Ruta API: `POST /api/generate-audio` con `maxDuration: 60` (Vercel)

### 4.4 GNews — Fallback de noticias

| Campo | Valor |
|-------|-------|
| Para que se usa | **Fallback** cuando el News Agent no tiene suficientes articulos |
| Dashboard | https://gnews.io |
| API keys | `GNEWS_API_KEY` |
| Endpoint | `https://gnews.io/api/v4/search` |
| Tier | **Gratis** (100 req/dia, max 10 resultados por query) |
| Estado | Funcionando como fallback |

### 4.5 NewsAPI.org — Fuente de noticias del agente

| Campo | Valor |
|-------|-------|
| Para que se usa | Fuente de noticias del News Agent (top headlines por categoria) |
| Dashboard | https://newsapi.org |
| API keys | `NEWSAPI_KEY` |
| Endpoint | `https://newsapi.org/v2/top-headlines` |
| Tier | **Gratis** (100 req/dia) |
| Estado | Funcionando |

**Detalles:**
- 6 categorias en ingles: technology, science, business, health, entertainment, sports
- Headlines en espanol: `language=es`, pageSize=30
- Filtra articulos `[Removed]` y URLs invalidas

### 4.6 Web Speech API — TTS gratis del navegador

| Campo | Valor |
|-------|-------|
| Para que se usa | Reproducir el guion en voz alta sin necesidad de API key |
| API keys | Ninguna (nativa del navegador) |
| Tier | **Gratis** |
| Estado | Funcionando |

**Detalles:**
- Busca voces es-ES: "Helena" (femenina), "Pablo" (masculina) en Windows
- Controles: Play/Pause/Stop
- No genera archivo MP3, solo reproduce en tiempo real

### 4.7 Vercel — Hosting y deploy

| Campo | Valor |
|-------|-------|
| Para que se usa | Hosting de la app Next.js en produccion |
| Dashboard | https://vercel.com |
| API keys | Ninguna en codigo (se configura via dashboard) |
| Tier | **Gratis** (hobby) |
| Estado | Configurado |
| Project ID | `prj_YgUD18SkMpKPe4xkOxmqAs47uAlK` |

---

## 5. Base de datos

**Motor:** PostgreSQL alojado en Supabase (plan gratis).

**Migraciones:** `supabase/migrations/001-004`

### 5.1 Tabla `profiles`

Datos personales del usuario. Se crea automaticamente al registrarse (trigger `on_auth_user_created`).

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK, FK → auth.users) | ID del usuario |
| nombre | text | Nombre del usuario |
| empresa | text | Empresa |
| rol | text | Rol profesional |
| sector | text | Sector (Tech, Finanzas, etc.) |
| edad | text | Rango de edad (ej: "25-34") |
| ciudad | text | Ciudad |
| nivel_conocimiento | text | principiante / intermedio / experto |
| objetivo_podcast | text | informarme / aprender / entretenerme |
| horario_escucha | text | manana / mediodia / tarde / noche |
| survey_completed | boolean | Si completo la encuesta del onboarding |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Ultima actualizacion |

**RLS:** Cada usuario solo ve y edita su propio perfil.

### 5.2 Tabla `preferences`

Preferencias de podcast del usuario (1 por usuario, upsert por `user_id`).

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| user_id | uuid (FK, UNIQUE) | ID del usuario |
| topics | text[] | Array de IDs de temas seleccionados |
| duration | integer | Duracion en minutos (5, 15 o 30) |
| tone | text | Tono: casual / profesional / deep-dive |
| voice | text | Voz: female / male |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Ultima actualizacion |

**RLS:** Cada usuario solo ve, crea y edita sus propias preferencias.

### 5.3 Tabla `episodes`

Episodios de podcast generados.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| user_id | uuid (FK) | ID del usuario |
| title | text | Titulo del episodio |
| script | text | Guion completo en Markdown |
| audio_url | text | URL del MP3 en Supabase Storage |
| duration | integer | Duracion configurada |
| tone | text | Tono usado |
| topics | text[] | Temas del episodio |
| articles | jsonb | Articulos usados como fuente |
| adjustments | text | Ajustes solicitados por el usuario |
| created_at | timestamptz | Fecha de creacion |

**Indice:** `episodes_user_date_idx` en (user_id, created_at DESC).
**RLS:** Cada usuario solo ve, crea y edita sus propios episodios.

### 5.4 Tabla `raw_news`

Noticias sin procesar, recopiladas por el News Agent.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| source_id | text | ID de la fuente (ej: `bbc-tech`) |
| source_name | text | Nombre de la fuente |
| source_type | text | `rss` o `newsapi` |
| title | text | Titular |
| description | text | Descripcion |
| content | text | Contenido completo |
| url | text (UNIQUE) | URL de la noticia |
| image_url | text | URL de imagen |
| author | text | Autor |
| language | text | Idioma (es/en) |
| category | text | Categoria de la fuente |
| published_at | timestamptz | Fecha de publicacion |
| fetched_at | timestamptz | Fecha de recopilacion |
| processed | boolean | Flag de procesado (default false) |
| created_at | timestamptz | Fecha de creacion |

**Indices:** `raw_news_unprocessed_idx`, `raw_news_source_idx`, `raw_news_fetched_idx`.
**RLS:** Solo acceso via service_role (sin politicas publicas).

### 5.5 Tabla `processed_news`

Noticias clasificadas por Claude.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| raw_news_id | uuid (FK → raw_news) | Referencia a noticia original |
| title | text | Titular |
| summary | text | Resumen en espanol (generado por Claude) |
| category | text | Categoria asignada por IA |
| relevance_score | integer (1-10) | Puntuacion de relevancia |
| language | text | Idioma detectado |
| keywords | text[] | Keywords extraidas por IA |
| url | text | URL de la noticia |
| source_name | text | Nombre de la fuente |
| published_at | timestamptz | Fecha de publicacion |
| processed_at | timestamptz | Fecha de procesamiento |
| created_at | timestamptz | Fecha de creacion |

**Indices:** `processed_news_relevance_idx`, `processed_news_category_idx`, `processed_news_date_idx`.
**RLS:** Lectura publica (la app consulta para generar podcasts).

### 5.6 Tabla `trending_topics`

Temas trending con score (creada pero no usada activamente todavia).

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| topic | text | Nombre del tema |
| score | numeric | Puntuacion |
| article_count | integer | Cantidad de articulos |
| category | text | Categoria |
| date | date | Fecha (UNIQUE con topic) |

### 5.7 Tabla `sources_health`

Estado de salud de cada fuente del agente.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| source_id | text (UNIQUE) | ID de la fuente |
| source_name | text | Nombre |
| source_type | text | Tipo (rss/newsapi) |
| last_fetch_at | timestamptz | Ultimo intento |
| last_success_at | timestamptz | Ultimo exito |
| last_error | text | Ultimo error |
| consecutive_failures | integer | Fallos consecutivos |
| total_articles_fetched | integer | Total acumulado |
| is_active | boolean | Si esta activa |

**RPCs:** `increment_articles_fetched(source_id, count)`, `increment_consecutive_failures(source_id)`.

### 5.8 Storage: Bucket `podcast-audio`

| Campo | Valor |
|-------|-------|
| Nombre | `podcast-audio` |
| Publico | Si (lectura) |
| Estructura | `{user_id}/{episode_id}.mp3` |
| Politica de upload | Solo usuarios autenticados, a su propia carpeta |

### 5.9 Relaciones

```
auth.users
  ├── profiles (1:1, id = auth.users.id, CASCADE)
  ├── preferences (1:1, user_id, CASCADE)
  └── episodes (1:N, user_id, CASCADE)

raw_news
  └── processed_news (1:1, raw_news_id, CASCADE)
```

---

## 6. Variables de entorno

Archivo: `.env.local` (no se sube al repo). Referencia: `.env.example`.

| Variable | Obligatoria | Descripcion | Donde obtenerla |
|----------|-------------|-------------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Si | URL del proyecto Supabase (`https://xxx.supabase.co`) | [Supabase Dashboard](https://supabase.com/dashboard) → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | Clave publica (anon key) de Supabase | Mismo sitio que arriba |
| `SUPABASE_SERVICE_ROLE_KEY` | Si | Clave de servicio de Supabase (usada por el News Agent) | Mismo sitio, seccion "service_role" |
| `ANTHROPIC_API_KEY` | Si | API key de Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `GNEWS_API_KEY` | No* | API key de GNews (fallback de noticias) | [gnews.io](https://gnews.io) → registrarse → API key |
| `NEWSAPI_KEY` | No** | API key de NewsAPI.org (fuente del agente) | [newsapi.org](https://newsapi.org) → registrarse → API key |
| `ELEVENLABS_API_KEY` | No*** | API key de ElevenLabs (TTS profesional) | [elevenlabs.io](https://elevenlabs.io) → Profile → API key |
| `ELEVENLABS_VOICE_ID` | No | ID de voz personalizada de ElevenLabs | [elevenlabs.io](https://elevenlabs.io) → Voices → copiar ID |

\* Solo necesaria como fallback si el News Agent no tiene suficientes articulos.
\*\* Necesaria para que el News Agent recopile noticias de NewsAPI.org.
\*\*\* Sin ElevenLabs funciona igual usando Web Speech API del navegador.

---

## 7. Agente de noticias

### 7.1 Fuentes configuradas

**8 feeds RSS:**

| ID | Nombre | Idioma | Categoria |
|----|--------|--------|-----------|
| bbc-world | BBC News World | en | general |
| bbc-tech | BBC Technology | en | technology |
| bbc-science | BBC Science | en | science |
| guardian-world | The Guardian World | en | general |
| guardian-tech | The Guardian Tech | en | technology |
| elpais-portada | El Pais | es | general |
| bbc-mundo | BBC Mundo | es | general |
| xataka | Xataka | es | technology |

**1 API:**

| ID | Nombre | Categorias |
|----|--------|------------|
| newsapi | NewsAPI.org | technology, science, business, health, entertainment, sports + headlines en espanol |

### 7.2 Flujo de recoleccion

```
npm run agent:fetch
│
├── 8 feeds RSS en paralelo (Promise.allSettled)
│   └── rss-parser con timeout 10s, User-Agent "PodcastAI-NewsAgent/1.0"
│
├── NewsAPI.org en secuencial (para no agotar rate limit)
│   ├── top-headlines por cada categoria (6 categorias, pageSize=20)
│   └── top-headlines en espanol (pageSize=30)
│
├── Dedup interno por URL (Set)
│
└── Batch upsert en raw_news (onConflict: "url", ignoreDuplicates: true)
    └── Actualiza sources_health con resultado de cada fuente
```

### 7.3 Procesamiento de noticias

```
npm run agent:process
│
├── Obtiene batch de 20 noticias raw sin procesar (config: processing.batch_size)
│
├── Deduplicacion por titulo
│   └── Normaliza: minusculas, sin acentos, sin puntuacion
│   └── Calcula word overlap entre titulos (>70% = duplicado)
│
├── Clasificacion con Claude (batches de 10)
│   ├── Modelo: claude-sonnet-4-20250514
│   ├── Temperature: 0.3
│   ├── Asigna: category, relevance_score (1-10), summary, language, keywords
│   ├── JSON parsing robusto (maneja objetos sueltos, trailing commas, valida campos)
│   └── 1 reintento con 3s backoff si falla
│
├── Guarda en processed_news
└── Marca raw_news como processed=true
```

### 7.4 Mapeo de topics del usuario a categorias del agente

| Topic del usuario | Categorias en processed_news |
|-------------------|------------------------------|
| tecnologia | technology |
| inteligencia-artificial | technology, science |
| ciencia | science |
| politica | politics |
| economia | business |
| startups | business, technology |
| salud | health |
| cultura | entertainment |

### 7.5 Comandos CLI

```bash
npm run agent:fetch      # Recopila noticias de todas las fuentes → raw_news
npm run agent:process    # Procesa batch de 20 noticias raw → classified processed_news
npm run agent:top        # Muestra top 10 noticias mas relevantes de hoy
npm run agent:top 2026-02-19  # Top 10 de una fecha especifica
```

---

## 8. Frontend / Web

### 8.1 Paginas

| Ruta | Descripcion | Autenticacion |
|------|-------------|---------------|
| `/` | Redirect a `/onboarding` | No |
| `/login` | Login con email/password | No |
| `/signup` | Registro (envia email de confirmacion) | No |
| `/auth/callback` | Callback de confirmacion de email | No |
| `/onboarding` | 3 pasos: encuesta personal → temas → config | Opcional |
| `/onboarding/confirmacion` | Resumen de preferencias, boton "Generar podcast" | Opcional |
| `/podcast` | Generacion y visualizacion del podcast | Opcional |
| `/dashboard` | Dashboard principal con ultimo episodio y preferencias | Si |
| `/historial` | Lista de todos los episodios generados | Si |
| `/historial/[id]` | Detalle de un episodio especifico | Si |
| `/perfil` | Editar datos personales y preferencias | Si |

### 8.2 Framework de UI

- **Tailwind CSS v4** con tema claro basado en `stone` (oklch)
- **shadcn/ui** (estilo new-york, Radix UI) para Dialog, Button, Card, etc.
- **Lucide React** para iconos
- **Fuentes:** Inter (sans) + Geist Mono (monospace)
- Fondo global: `bg-stone-100`

### 8.3 Rutas protegidas

El archivo `proxy.ts` actua como middleware:
- Protege `/dashboard`, `/historial`, `/perfil` → redirige a `/login` si no hay sesion
- Si el usuario logueado va a `/login` o `/signup` → redirige a `/dashboard`
- Refresca el token de Supabase en cada request

---

## 9. Despliegue

| Componente | Plataforma | URL |
|------------|-----------|-----|
| Frontend + API | Vercel | Dominio automatico de Vercel |
| Base de datos | Supabase | `NEXT_PUBLIC_SUPABASE_URL` |
| Storage (audio) | Supabase Storage | Bucket `podcast-audio` |
| News Agent | Local (CLI manual) | No desplegado |

### 9.1 Como hacer deploy

```bash
# El deploy se hace automaticamente al hacer push a master
git push origin master

# O manualmente con Vercel CLI
npx vercel --prod
```

### 9.2 Variables de entorno en Vercel

Todas las variables de `.env.local` deben estar configuradas en el dashboard de Vercel:
Settings → Environment Variables.

### 9.3 Configuracion de Vercel

- **Framework:** Next.js (detectado automaticamente)
- **Build command:** `next build`
- **maxDuration:** 60s en `generate-audio/route.ts` (para que ElevenLabs tenga tiempo)

---

## 10. Comandos utiles

### 10.1 Scripts de package.json

```bash
# === App ===
npm run dev             # Arranca servidor de desarrollo (Next.js + webpack, puerto 3000)
npm run build           # Build de produccion (tsc + next build)
npm run start           # Arranca servidor de produccion
npm run lint            # ESLint

# === News Agent ===
npm run agent:fetch     # Recopila noticias de 9 fuentes → raw_news
npm run agent:process   # Procesa batch de 20 raw → processed_news (Claude)
npm run agent:top       # Top 10 noticias mas relevantes de hoy
```

### 10.2 Arrancar el proyecto en local

```bash
# 1. Clonar el repo
git clone <url> && cd podcast-ai

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con tus API keys

# 4. Crear tablas en Supabase
# Ejecutar las 4 migraciones en el SQL Editor de Supabase:
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/002_add_voice_to_preferences.sql
# supabase/migrations/003_add_survey_fields.sql
# supabase/migrations/004_news_agent_tables.sql

# 5. Arrancar el servidor
npm run dev
# Abre http://localhost:3000
```

### 10.3 Ejecutar el agente

```bash
# Recopilar noticias (ejecutar periodicamente)
npm run agent:fetch

# Procesar con IA (ejecutar despues de fetch)
npm run agent:process

# Ver las mejores noticias
npm run agent:top
```

### 10.4 Generar un podcast

1. Abrir `http://localhost:3000`
2. Completar el onboarding (encuesta + temas + config)
3. En la pantalla de confirmacion, clic "Generar mi podcast"
4. La app consulta `processed_news` (o GNews como fallback), Claude genera el guion
5. Clic "Escuchar" para Web Speech API o "Generar audio" para ElevenLabs

### 10.5 Verificar el build

```bash
npx tsc --noEmit    # Verifica tipos sin emitir archivos
npm run build       # Build completo de produccion
```

---

## 11. Estado actual del proyecto

### 11.1 Terminado y funcionando

| Feature | Estado |
|---------|--------|
| Registro e inicio de sesion (email/password) | OK |
| Onboarding completo (3 pasos: encuesta + temas + config) | OK |
| Encuesta personal (nombre, edad, ciudad, nivel, objetivo, horario) | OK |
| News Agent con 9 fuentes (8 RSS + NewsAPI) | OK |
| Deduplicacion de noticias por titulo | OK |
| Clasificacion con Claude (batches, retry, JSON robusto) | OK |
| Batch upsert en raw_news | OK |
| Generacion de guion con Claude personalizado al perfil | OK |
| Validacion estricta de inputs en API (topics, duration, tone, adjustments) | OK |
| Proteccion doble-click con AbortController | OK |
| Reproduccion con Web Speech API (fallback TTS) | OK |
| Generacion de audio con ElevenLabs | OK |
| Reproductor de audio completo (play, pause, seek, velocidad) | OK |
| Ajustar/regenerar episodio con instrucciones | OK |
| Dashboard con ultimo episodio y preferencias | OK |
| Historial de episodios | OK |
| Detalle de episodio | OK |
| Edicion de perfil | OK |
| Markdown renderer (tema claro) | OK |
| Emoji removal universal (regex Unicode) en TTS | OK |
| Sanitizacion de newlines en prompt | OK |
| Logger profesional con contexto y colores | OK |
| Tipos centralizados | OK |
| getTopicById utility (evita TOPICS.find repetido) | OK |
| Constante ARTICLES_BY_DURATION compartida | OK |
| Cliente Supabase reutilizado en route | OK |
| Log warning en profile catch (no silencioso) | OK |
| JSON.parse seguro en localStorage | OK |
| Response.ok antes de JSON parse | OK |
| Build de produccion | OK |

### 11.2 A medias / con limitaciones

| Feature | Estado |
|---------|--------|
| Concatenacion de MP3 cruda | Los chunks de audio se concatenan byte a byte. Puede causar glitches en los cortes. Lo correcto seria usar un muxer MP3. |
| News Agent sin automatizar | Se ejecuta manualmente con `npm run agent:fetch/process`. Deberia automatizarse con cron o scheduler. |
| Tabla `trending_topics` | Creada en la migracion pero no se usa activamente en la app. |

### 11.3 TODO — Pendiente

| Tarea | Prioridad |
|-------|-----------|
| Automatizar agent:fetch y agent:process con cron/scheduler | Media |
| Tests unitarios (al menos newsapi.ts, generate-script.ts, elevenlabs.ts) | Media |
| Paginacion en historial (carga todos los episodios de golpe) | Baja |
| Dominio custom (solo tiene el dominio automatico de Vercel) | Baja |
| Usar trending_topics para sugerir temas | Baja |
| Muxer MP3 para concatenacion correcta de chunks | Baja |

---

## 12. Costes

### 12.1 Servicios gratuitos

| Servicio | Plan | Limite |
|----------|------|--------|
| Supabase | Free | 500 MB DB, 1 GB storage, 50k MAU, 500k Edge Functions |
| GNews | Free | 100 requests/dia, max 10 resultados |
| NewsAPI.org | Free | 100 requests/dia |
| Vercel | Hobby | 100 GB bandwidth, 6000 min build, serverless functions 60s max |
| Web Speech API | Gratis | Sin limite (nativa del navegador) |

### 12.2 Servicios de pago

| Servicio | Coste estimado | Detalle |
|----------|---------------|---------|
| Anthropic (Claude) | ~$2-10/mes | Depende del uso. Cada podcast: ~4k-12k output tokens ($0.015/1k output). Clasificacion: ~2k tokens por batch de 10 articulos. Con uso moderado (5 podcasts/dia + 1 fetch+process/dia): ~$5/mes. |
| ElevenLabs | $0-5/mes | 10k caracteres gratis/mes. Un podcast de 5min son ~800 palabras (~4.5k chars). Plan starter: $5/mes por 30k chars. **Opcional**: se puede usar Web Speech API gratis. |

### 12.3 Coste mensual estimado

| Escenario | Coste |
|-----------|-------|
| Solo Web Speech API (sin ElevenLabs) | ~$2-5/mes (solo Claude) |
| Con ElevenLabs (uso moderado) | ~$7-15/mes (Claude + ElevenLabs) |
| Todo gratis excepto Claude | ~$2-5/mes |
