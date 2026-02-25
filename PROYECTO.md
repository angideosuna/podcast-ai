# WaveCast

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

**Nombre:** WaveCast

**En una frase:** Aplicacion web que genera podcasts diarios hiperpersonalizados con noticias reales del dia y voces AI.

**Flujo completo:**

1. Un **News Agent** autonomo recopila noticias de 9 fuentes (8 feeds RSS + NewsAPI.org) y las guarda en bruto en Supabase.
2. El agente **deduplica** las noticias por similitud de titulo/descripcion con stopwords y las **clasifica con Claude** (categoria, relevancia 1-10, resumen, keywords, sentiment, impact_scope, story_id).
3. El usuario se registra, completa una **encuesta personal** (nombre, nivel de conocimiento, objetivo, horario) y configura sus **preferencias** (temas, duracion, tono, voz, horario de generacion).
4. Al generar un podcast, la app consulta las noticias clasificadas del agente (o GNews como fallback), obtiene **insights del historial de feedback** del usuario, y **Claude genera un guion** en formato storytelling adaptado al perfil del oyente.
5. El guion se puede escuchar con **Web Speech API** (gratis, navegador) o convertir a audio con **ElevenLabs** (voz profesional).
6. Los episodios se guardan en Supabase y el usuario puede consultarlos en su **historial** con filtros y busqueda full-text.
7. **Cron jobs automatizados** (Vercel) ejecutan fetch, procesamiento, generacion programada, limpieza y digest semanal.

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
│   ├── layout.tsx                    # Layout raiz (Inter + Montserrat, bg negro)
│   ├── page.tsx                      # Landing page publica (redirect a /dashboard si logueado)
│   ├── globals.css                   # Tailwind + paleta Spotify (negro + verde)
│   ├── manifest.ts                   # PWA manifest (WaveCast)
│   ├── error.tsx                     # Error boundary global
│   ├── not-found.tsx                 # Pagina 404
│   ├── login/page.tsx                # Login con email/password
│   ├── signup/page.tsx               # Registro con confirmacion por email
│   ├── onboarding/
│   │   └── page.tsx                  # Onboarding 2 pasos (temas + config)
│   ├── podcast/page.tsx              # Redirect a /dashboard (legacy)
│   ├── auth/callback/route.ts        # Callback de confirmacion de email
│   ├── shared/[id]/page.tsx          # Pagina publica de episodios compartidos
│   ├── api/
│   │   ├── generate-podcast/route.ts # POST: genera guion con Claude
│   │   ├── generate-audio/route.ts   # POST: genera audio con ElevenLabs
│   │   ├── preferences/route.ts      # GET/POST: preferencias del usuario
│   │   ├── profile/route.ts          # GET/POST: perfil del usuario
│   │   ├── schedule/route.ts         # GET/POST: horario de generacion
│   │   ├── feedback/route.ts         # POST: feedback de episodios (thumbs up/down + tags)
│   │   ├── metrics/route.ts          # POST: metricas de escucha pasivas
│   │   ├── trending/route.ts         # GET: temas trending del dia
│   │   ├── clips/route.ts           # GET/POST: clips trending de 5 min (cache + thundering herd)
│   │   ├── share/route.ts            # POST: compartir episodio publicamente
│   │   ├── suggest-topics/route.ts   # GET: sugerencias de temas basadas en tendencias
│   │   └── cron/                     # Cron jobs automatizados (Vercel)
│   │       ├── fetch-news/route.ts   # Recopila noticias (diario 05:00 UTC)
│   │       ├── process-news/route.ts # Procesa noticias con Claude (diario 05:30 UTC)
│   │       ├── generate-scheduled/route.ts # Genera podcasts programados (diario 07:00 UTC)
│   │       ├── cleanup/route.ts      # Limpia noticias antiguas (domingos 03:00 UTC)
│   │       └── weekly-digest/route.ts # Genera digest semanal (domingos 10:00 UTC)
│   └── (authenticated)/
│       ├── layout.tsx                # Layout con NavHeader
│       └── dashboard/page.tsx        # Dashboard principal con 4 tabs
├── components/
│   ├── nav-header.tsx                # Barra de navegacion (desktop + mobile)
│   ├── category-card.tsx             # Card de seleccion de categoria/tema
│   ├── duration-picker.tsx           # Selector de duracion (5/15/30 min)
│   ├── tone-picker.tsx               # Selector de tono (casual/profesional/deep-dive)
│   ├── voice-picker.tsx              # Selector de voz (femenina/masculina)
│   ├── option-picker.tsx             # Picker generico para encuesta
│   ├── audio-player.tsx              # Reproductor de audio (ElevenLabs MP3)
│   ├── browser-audio-player.tsx      # Reproductor Web Speech API (fallback)
│   ├── clip-audio-player.tsx         # Reproductor inline para clips trending (sin metricas)
│   ├── adjust-episode.tsx            # Dialog para ajustar/regenerar episodio
│   ├── episode-feedback.tsx          # Feedback de episodio (thumbs up/down + tags + comentario)
│   ├── otros-section.tsx             # Seccion "Otros" reutilizable
│   ├── dashboard/                    # Componentes del dashboard (separados por tab)
│   │   ├── hoy-tab.tsx               # Tab Hoy: generacion + episodio del dia + digest + stats
│   │   ├── historial-tab.tsx         # Tab Historial: lista con filtros y busqueda full-text
│   │   ├── descubrir-tab.tsx         # Tab Descubrir: clips trending + temas del dia
│   │   └── perfil-tab.tsx            # Tab Mi Perfil: 4 secciones (perfil, preferencias, horario, cuenta) con guardado independiente
│   ├── onboarding/                   # Componentes del onboarding (separados por paso)
│   │   # step-survey.tsx y step-schedule.tsx eliminados en v17.3 (logica migrada a perfil-tab.tsx)
│   │   ├── step-topics.tsx           # Paso 1: seleccion de temas
│   │   └── step-config.tsx           # Paso 2: duracion + tono + voz + nombre
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
│   ├── generate-script.ts            # Generacion de guiones con Claude + ARTICLES_BY_DURATION + timeout
│   ├── generate-clip.ts              # Generacion de clips trending de 5 min (busca articulos + llama generateScript)
│   ├── generate-podcast.ts           # Logica core de generacion (compartida entre ruta manual y cron)
│   ├── elevenlabs.ts                 # TTS con ElevenLabs (chunking, voice selection)
│   ├── tts-utils.ts                  # Limpieza de guion para TTS (regex Unicode emojis)
│   ├── newsapi.ts                    # Cliente GNews API (fallback)
│   ├── news-cache.ts                 # Cache en memoria con TTL para articulos (1 hora)
│   ├── markdown.ts                   # Renderizado Markdown → HTML (tema oscuro, HTML sanitizado)
│   ├── topics.ts                     # 8 temas + TOPICS_MAP + getTopicById() + TOPIC_TO_CATEGORIES
│   ├── rate-limit.ts                 # Rate limiting en memoria para API routes
│   ├── retry.ts                      # Retry con backoff exponencial (para APIs externas)
│   ├── csrf.ts                       # Proteccion CSRF (valida Origin header en mutating requests)
│   ├── user-insights.ts              # Insights del usuario basados en feedback y metricas
│   ├── types.ts                      # Tipos centralizados (Article, Episode, Preferences, Profile)
│   ├── logger.ts                     # Logger con contexto y colores
│   ├── auth-utils.ts                 # Utilidad logout()
│   ├── utils.ts                      # cn() para clases CSS (clsx + tailwind-merge)
│   ├── __tests__/                    # Tests unitarios
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
│           │   └── get-articles.ts   # fetchFromAgent() — selección inteligente de artículos
│           ├── scripts/
│           │   ├── fetch.ts          # CLI: npm run agent:fetch
│           │   ├── process.ts        # CLI: npm run agent:process
│           │   ├── top.ts            # CLI: npm run agent:top [fecha]
│           │   └── cleanup.ts        # CLI: npm run agent:cleanup (limpia noticias antiguas)
│           └── utils/
│               ├── types.ts          # Tipos del agente
│               └── env.ts            # Carga .env.local para scripts CLI
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql    # profiles, preferences, episodes, storage
│       ├── 002_add_voice_to_preferences.sql
│       ├── 003_add_survey_fields.sql # edad, ciudad, nivel, objetivo, horario
│       ├── 004_news_agent_tables.sql # raw_news, processed_news, trending_topics, sources_health
│       ├── 005_add_schedule_fields.sql # periodicidad, dias_personalizados en profiles
│       ├── 006_schedules.sql         # Tabla schedules (generacion automatica)
│       ├── 007_feedback_and_metrics.sql # episode_feedback + listening_metrics
│       ├── 008_shared_episodes.sql   # Columnas is_shared, shared_at en episodes
│       ├── 009_fulltext_search_episodes.sql # tsvector + GIN index + RPC search_episodes()
│       └── 010_enhanced_classification.sql # sentiment, impact_scope, story_id en processed_news
├── vercel.json                       # Configuracion de cron jobs (5 tareas programadas)
├── proxy.ts                          # Middleware: sesion + rutas protegidas + CSRF + onboarding
├── package.json
├── tsconfig.json
├── next.config.ts                    # Permite imagenes de *.supabase.co
├── components.json                   # Config de shadcn/ui
├── postcss.config.mjs
└── eslint.config.mjs
```

### 3.2 Flujo de datos

```
┌──────────────────────────────────────────────────────────────────┐
│                    NEWS AGENT (CLI + Cron)                        │
│                                                                    │
│  8 RSS feeds ──┐                                                  │
│                ├──→ raw_news (Supabase) ──→ dedup ──→ Claude ──→ processed_news
│  NewsAPI.org ──┘                                                  │
│                                                                    │
│  Vercel Cron: fetch (05:00) → process (05:30) → cleanup (dom 03:00)
└──────────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────────┐
│                    WEB APP (Next.js)                               │
│                                                                    │
│  Usuario ──→ Onboarding (encuesta + horario + temas + config)    │
│          ──→ POST /api/generate-podcast                          │
│                 ├──→ fetchFromAgent(smart selection) + cache       │
│                 ├──→ fallback: GNews API                          │
│                 ├──→ getUserInsights() — feedback/metricas        │
│                 ├──→ trending_topics (top 3 del dia)              │
│                 ├──→ Claude genera guion personalizado             │
│                 └──→ Guarda episodio en Supabase                  │
│          ──→ POST /api/generate-audio                            │
│                 ├──→ ElevenLabs TTS                               │
│                 └──→ Sube MP3 a Supabase Storage                  │
│          ──→ POST /api/feedback — thumbs up/down + tags           │
│          ──→ POST /api/metrics — escucha pasiva                   │
│          ──→ Escucha con Web Speech API (alternativa)             │
│                                                                    │
│  Cron: generate-scheduled (07:00) → weekly-digest (dom 10:00)    │
└──────────────────────────────────────────────────────────────────┘
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
- Full-text search con `tsvector` (config 'spanish') + indice GIN en episodios
- RPC `search_episodes()` para busqueda con ranking de relevancia

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
- Prompt con noticias (incluye sentiment, impact_scope, related_articles), instrucciones de tono, variaciones aleatorias
- Bloques contextuales: trending topics, tono por noticia, conexiones, noticias relacionadas, noticia sorpresa
- Si el usuario tiene perfil, inyecta bloque `PERFIL DEL OYENTE` (nombre, nivel, objetivo, horario)
- Si hay suficiente feedback (>= 3), inyecta bloque `HISTORIAL DE PREFERENCIAS DEL OYENTE` (insights)
- `max_tokens`: 4096 (podcast 5min), 8192 (15min), 12288 (30min) — dinamico segun duracion
- `temperature`: 0.9
- **Timeout**: 55 segundos (AbortController) para evitar bloqueos en Vercel
- **Cliente singleton**: una sola instancia de Anthropic reutilizada entre peticiones
- **Retry**: backoff exponencial con jitter via `lib/retry.ts` (3 reintentos, errores transitorios)

**Sistema de prompts (v3):**

| Componente | Descripcion |
|-----------|-------------|
| System prompt | Personalidad de podcaster: curioso, apasionado, cercano. Expresiones naturales del espanol de Espana. 15 frases prohibidas que suenan a IA. |
| Tone instructions | Instrucciones detalladas por tono con ejemplos concretos de COMO SI y COMO NO debe sonar. |
| Variabilidad | Pools aleatorios: 6 estilos de apertura, 5 de transicion, 5 de cierre, 4 de sorpresa. Cada episodio suena diferente. |
| Trending topics | Si hay trending del dia, se inyectan los 3 principales para que Claude los mencione naturalmente si coinciden con las noticias. |
| Tono por noticia | Cada noticia incluye sentiment e impact_scope. Claude adapta energia (positive→entusiasmo, negative→empatia, global→impacto mundial). |
| Conexiones | Instruccion explicita para conectar noticias relacionadas con transiciones naturales en vez de bloques independientes. |
| Noticias relacionadas | Si hay articulos agrupados por story_id, se marcan con [RELACIONADAS] para narracion consolidada. |
| Noticia sorpresa | Si el ultimo articulo es de categoria diferente a los temas del usuario, se sugiere una frase de transicion sorpresa. |
| Estructura | Flexible, no rigida. Storytelling libre en vez de "Titular → Contexto → Opinion". |
| Perfil del oyente | Bloque contextual inyectado despues de REGLAS INQUEBRANTABLES. Adapta nivel (principiante→explicar conceptos, experto→terminologia tecnica), objetivo (informar→resumen claro, entretener→contenido dinamico), y horario (manana→energia, noche→relajado). |
| Insights del oyente | Bloque con historial de feedback: temas valorados positivamente/negativamente, tags mas comunes, tasa de escucha completa, velocidad habitual. Solo si hay >= 3 feedbacks. |

**Constante compartida:** `ARTICLES_BY_DURATION` (exportada desde `generate-script.ts`) define cuantas noticias usar por duracion: `{5: 3, 15: 5, 30: 8}`. Se reutiliza en la API route y en `generate-podcast.ts`.

**Configuracion de tiempos:**

| Duracion | Noticias | Intro | Cierre | Segundos/noticia |
|----------|----------|-------|--------|-----------------|
| 5 min | 3 | 30s | 30s | ~80s |
| 15 min | 5 | 45s | 45s | ~150s |
| 30 min | 8 | 60s | 60s | ~195s |

**Tonos soportados:**
- `casual`: Como Ibai contandote las noticias. Energia alta, humor, coloquial total. Con ejemplos DO/DON'T.
- `profesional`: Analista tipo The Economist en espanol. Serio pero interesante, datos con peso, ironias puntuales. Con ejemplos DO/DON'T.
- `deep-dive`: Experto apasionado tipo Jordi Wild. Contexto historico, conexiones inesperadas, analisis profundo. Con ejemplos DO/DON'T.

**Uso en clasificacion (`src/agents/news-agent/processors/classifier.ts`):**
- Batches de 10 articulos → Claude asigna: categoria, relevancia 1-10, resumen, keywords, sentiment, impact_scope, story_id
- `max_tokens`: 3072 por batch
- `temperature`: 0.3
- 1 reintento con 3s de backoff si el batch falla
- Validacion robusta: defaults para campos invalidos, truncado de story_id a 50 chars

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
| Archivo | `lib/newsapi.ts` |

**Mapeo de temas a busquedas GNews:**

| Tema del usuario | Query en GNews |
|-----------------|----------------|
| tecnologia | `tecnologia OR technology` |
| inteligencia-artificial | `inteligencia artificial OR AI` |
| ciencia | `ciencia OR science` |
| politica | `politica OR politics` |
| economia | `economia OR finanzas` |
| startups | `startups OR emprendimiento` |
| salud | `salud OR medicina` |
| cultura | `cultura OR entretenimiento` |

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
| Para que se usa | Hosting de la app Next.js en produccion + cron jobs automatizados |
| Dashboard | https://vercel.com |
| API keys | Ninguna en codigo (se configura via dashboard) |
| Tier | **Gratis** (hobby) |
| Estado | Configurado |
| Project ID | `prj_YgUD18SkMpKPe4xkOxmqAs47uAlK` |
| Org ID | `team_UnanlHXGfKm6eBPAdJNfbCMr` |
| URL | https://podcast-ai-sigma.vercel.app |
| maxDuration | 60s en `generate-audio/route.ts` |

---

## 5. Base de datos

**Motor:** PostgreSQL alojado en Supabase (plan gratis).

**Migraciones:** `supabase/migrations/001-011`

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
| periodicidad | text | Frecuencia de generacion (migration 005) |
| dias_personalizados | jsonb | Dias de generacion personalizados (migration 005) |
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
| is_shared | boolean | Si el episodio es publico (migration 008) |
| shared_at | timestamptz | Fecha de comparticion (migration 008) |
| search_vector | tsvector (generated) | Vector de busqueda full-text (migration 009) |
| created_at | timestamptz | Fecha de creacion |

**Indices:** `episodes_user_date_idx` (user_id, created_at DESC), `episodes_shared_idx` (id WHERE is_shared), `episodes_search_idx` (GIN en search_vector).
**RLS:** Cada usuario solo ve, crea y edita sus propios episodios. Episodios compartidos son publicos (lectura).
**RPC:** `search_episodes(p_user_id, p_query, p_limit, p_offset)` — busqueda full-text con ranking.

### 5.4 Tabla `schedules`

Horarios de generacion automatica de podcasts (migration 006).

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| user_id | uuid (FK, UNIQUE) | ID del usuario |
| time | time | Hora de generacion (default 08:00) |
| frequency | text | Frecuencia: daily / weekdays / custom |
| custom_days | integer[] | Dias personalizados (0=dom, 6=sab) |
| is_active | boolean | Si esta activo (default true) |
| last_generated_at | timestamptz | Ultima generacion |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Ultima actualizacion |

**RLS:** Cada usuario solo gestiona su propio schedule.

### 5.5 Tabla `episode_feedback`

Feedback explicito del usuario sobre episodios (migration 007).

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| episode_id | uuid (FK → episodes) | Episodio valorado |
| user_id | uuid (FK → auth.users) | Usuario |
| rating | smallint | Valoracion: 1 (thumbs down) o 5 (thumbs up) |
| tags | text[] | Tags seleccionados (ej: "Buen ritmo", "Muy largo") |
| comment | text | Comentario opcional (max 200 chars) |
| created_at | timestamptz | Fecha de creacion |

**Constraint:** UNIQUE(episode_id, user_id) — un feedback por episodio por usuario.
**RLS:** Cada usuario solo gestiona su propio feedback.

### 5.6 Tabla `listening_metrics`

Metricas de escucha pasivas (migration 007).

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| episode_id | uuid (FK → episodes) | Episodio |
| user_id | uuid (FK → auth.users) | Usuario |
| total_listen_time_seconds | integer | Tiempo total de escucha |
| completion_rate | numeric | Tasa de completacion (0-1) |
| playback_speed | numeric | Velocidad de reproduccion |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Ultima actualizacion |

**Constraint:** UNIQUE(episode_id, user_id).
**RLS:** Cada usuario solo gestiona sus propias metricas.

### 5.7 Tabla `raw_news`

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

### 5.8 Tabla `processed_news`

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
| sentiment | text | Tono: positive / negative / neutral (migration 010) |
| impact_scope | text | Alcance: local / national / global (migration 010) |
| story_id | text | ID kebab-case que agrupa noticias del mismo tema (migration 010) |
| url | text | URL de la noticia |
| source_name | text | Nombre de la fuente |
| published_at | timestamptz | Fecha de publicacion |
| processed_at | timestamptz | Fecha de procesamiento |
| created_at | timestamptz | Fecha de creacion |

**Indices:** `processed_news_relevance_idx`, `processed_news_category_idx`, `processed_news_date_idx`, `processed_news_story_idx` (parcial, WHERE story_id IS NOT NULL), `processed_news_sentiment_idx`.
**RLS:** Lectura publica (la app consulta para generar podcasts).

### 5.9 Tabla `trending_topics`

Temas trending con score.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| topic | text | Nombre del tema |
| score | numeric | Puntuacion |
| article_count | integer | Cantidad de articulos |
| category | text | Categoria |
| date | date | Fecha (UNIQUE con topic) |

Se consulta activamente desde `GET /api/trending` y se muestra en el tab "Trending" del dashboard.

### 5.10 Tabla `sources_health`

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

### 5.11 Tabla `trending_clips`

Cache de clips trending de 5 minutos generados on-demand. Un clip por tema por dia. Campo `status` previene thundering herd.

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid (PK) | ID autogenerado |
| topic | text | Tema del clip |
| date | date | Fecha (default CURRENT_DATE) |
| script | text | Guion generado |
| articles | jsonb | Articulos usados como fuente |
| status | text | Estado: generating, ready, error |
| error_message | text | Mensaje de error (si fallo) |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Ultima actualizacion |

**Constraint:** UNIQUE(topic, date). **RLS:** SELECT publico.

### 5.12 Storage: Bucket `podcast-audio`

| Campo | Valor |
|-------|-------|
| Nombre | `podcast-audio` |
| Publico | Si (lectura) |
| Estructura | `{user_id}/{episode_id}.mp3` |
| Politica de upload | Solo usuarios autenticados, a su propia carpeta |

### 5.13 Relaciones

```
auth.users
  ├── profiles (1:1, id = auth.users.id, CASCADE)
  ├── preferences (1:1, user_id, CASCADE)
  ├── episodes (1:N, user_id, CASCADE)
  │     ├── episode_feedback (1:1 por usuario, episode_id, CASCADE)
  │     └── listening_metrics (1:1 por usuario, episode_id, CASCADE)
  └── schedules (1:1, user_id, CASCADE)

raw_news
  └── processed_news (1:1, raw_news_id, CASCADE)

trending_clips (standalone, cache diario por topic)
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
| `CRON_SECRET` | Si**** | Secret para autenticar cron jobs de Vercel | Generado manualmente, configurado en Vercel env vars |

\* Solo necesaria como fallback si el News Agent no tiene suficientes articulos.
\*\* Necesaria para que el News Agent recopile noticias de NewsAPI.org.
\*\*\* Sin ElevenLabs funciona igual usando Web Speech API del navegador.
\*\*\*\* Necesaria para que los cron jobs de Vercel se ejecuten de forma segura.

---

## 7. Agente de noticias

### 7.1 Fuentes configuradas

**Configuracion v2.0** (`sources.json`): 19 feeds RSS + 1 API. Formato plano con array `sources[]` y campo `type` (rss/newsapi).

**19 feeds RSS:**

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
| eldiario | elDiario.es | es | general |
| 20minutos | 20 Minutos | es | general |
| elmundo-portada | El Mundo | es | general |
| elespanol-espana | El Espanol - Espana | es | politics |
| elespanol-invertia | El Espanol - Invertia | es | business |
| europapress | Europa Press | es | general |
| genbeta | Genbeta | es | technology |
| newtral | Newtral | es | politics |
| expansion | Expansion | es | business |
| gnews-ia | Google News - IA (ES) | es | technology |
| gnews-startups | Google News - Startups Espana | es | business |

**1 API:**

| ID | Nombre | Categorias |
|----|--------|------------|
| newsapi | NewsAPI.org | technology, science, business, health, entertainment, sports + headlines en espanol |

### 7.2 Automatizacion con Vercel Cron

Configurado en `vercel.json`:

| Cron job | Ruta | Horario | Descripcion |
|----------|------|---------|-------------|
| Fetch news | `/api/cron/fetch-news` | `0 5 * * *` (05:00 UTC diario) | Recopila noticias de 20 fuentes |
| Process news | `/api/cron/process-news` | `30 5 * * *` (05:30 UTC diario) | Clasifica noticias con Claude |
| Generate scheduled | `/api/cron/generate-scheduled` | `0 7 * * *` (07:00 UTC diario) | Genera podcasts programados por usuarios |
| Cleanup | `/api/cron/cleanup` | `0 3 * * 0` (03:00 UTC domingos) | Limpia noticias antiguas |
| Weekly digest | `/api/cron/weekly-digest` | `0 10 * * 0` (10:00 UTC domingos) | Genera digest semanal |

### 7.3 Flujo de recoleccion

```
npm run agent:fetch (o Vercel Cron /api/cron/fetch-news)
│
├── 19 feeds RSS en paralelo (Promise.allSettled)
│   └── rss-parser con timeout 15s, User-Agent "WaveCast-NewsAgent/2.0"
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

### 7.4 Procesamiento de noticias

```
npm run agent:process (o Vercel Cron /api/cron/process-news)
│
├── Obtiene batch de 40 noticias raw sin procesar (config: processing.batch_size)
│
├── Deduplicacion v2 (dos pasadas)
│   ├── Pasada 1 — Dedup interna del batch:
│   │   └── Normaliza: minusculas, sin acentos, sin puntuacion, sin stopwords (es+en)
│   │   └── Duplicado si: >70% word overlap en titulo O >60% en descripcion
│   │   └── Al encontrar duplicados, se queda con el de descripcion mas larga
│   └── Pasada 2 — Dedup cross-temporal contra processed_news:
│       └── Consulta titulos de las ultimas 24h en processed_news
│       └── Descarta si >70% word overlap en titulo contra ya procesados
│
├── Clasificacion con Claude (batches de 10)
│   ├── Modelo: claude-sonnet-4-20250514
│   ├── Temperature: 0.3
│   ├── Asigna: category, relevance_score (1-10), summary, language, keywords, sentiment, impact_scope, story_id
│   ├── max_tokens: 3072 por batch
│   ├── JSON parsing robusto (maneja objetos sueltos, trailing commas, valida 9 campos con defaults)
│   └── 1 reintento con 3s backoff si falla
│
├── Guarda en processed_news
└── Marca raw_news como processed=true
```

### 7.5 Mapeo de topics del usuario a categorias del agente

| Topic del usuario | Categorias en processed_news |
|-------------------|------------------------------|
| tecnologia | technology |
| inteligencia-artificial | technology, science |
| ciencia | science |
| politica | politics, general |
| economia | business |
| startups | business, technology |
| salud | health |
| cultura | entertainment |

### 7.6 Comandos CLI

```bash
npm run agent:fetch      # Recopila noticias de 20 fuentes → raw_news
npm run agent:process    # Procesa batch de 40 noticias raw → classified processed_news
npm run agent:top        # Muestra top 10 noticias mas relevantes de hoy
npm run agent:top 2026-02-19  # Top 10 de una fecha especifica
npm run agent:cleanup    # Limpia noticias antiguas (processed >7d, raw processed >7d, raw unprocessed >14d)
```

---

## 8. Frontend / Web

### 8.1 Paginas

| Ruta | Descripcion | Autenticacion |
|------|-------------|---------------|
| `/` | Landing page publica con hero, features y CTA. Redirect a `/dashboard` si logueado | No |
| `/login` | Login con email/password | No |
| `/signup` | Registro (envia email de confirmacion) | No |
| `/auth/callback` | Callback de confirmacion de email | No |
| `/onboarding` | 4 pasos: encuesta personal → horario → temas → config | Opcional |
| `/onboarding/confirmacion` | Eliminada (v15) — redireccion directa a /dashboard | — |
| `/podcast` | Redirect a /dashboard (legacy) | No |
| `/dashboard` | Dashboard principal con 4 tabs: Hoy, Historial, Descubrir, Mi Perfil | Si |
| `/shared/[id]` | Pagina publica de episodio compartido (sin auth) | No |

### 8.2 Framework de UI — Estetica Spotify

- **Tailwind CSS v4** con paleta oscura estilo Spotify
- **shadcn/ui** (estilo new-york, Radix UI) para Dialog, Button, Card, etc.
- **Lucide React** para iconos
- **Fuentes:** Inter (body, sans-serif) + Montserrat (headings h1/h2, bold) + Geist Mono (monospace)

**Paleta de colores:**

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-forest` | `#1DB954` | Verde primario Spotify (botones, acentos, links) |
| `--color-forest-light` | `#1ed760` | Verde hover |
| `--color-cream` | `#000000` | Fondo principal (negro puro) |
| `--color-cream-light` | `#121212` | Surface (cards, paneles) |
| `--color-cream-dark` | `#282828` | Elevated surface (inputs, selects) |
| `--color-dark` | `#FFFFFF` | Texto principal (blanco) |
| `--color-muted` | `#B3B3B3` | Texto secundario |
| `--color-muted-light` | `#727272` | Texto terciario |

**Componentes base:**
- `.glass-card` → `bg-[#121212] border border-white/10 rounded-lg` (flat, sin blur)
- `.glass-input` → `bg-[#282828] border border-white/10 rounded-lg` con focus ring verde
- Backgrounds solidos en nav, tab bar y player (sin backdrop-blur)

### 8.3 Dashboard — 4 tabs

El dashboard (`/dashboard`) es un componente con 4 tabs accesibles (ARIA tablist/tab/tabpanel):

| Tab | Componente | Descripcion |
|-----|-----------|-------------|
| Podcast | `PodcastTab` | Episodio del dia, digest semanal, ultimos episodios, estadisticas, banner PWA |
| Historial | `HistorialTab` | Lista de episodios con filtros (tema, tono, fecha), busqueda full-text, paginacion |
| Trending | `TrendingTab` | Top 10 temas trending del dia con scores y categorias |
| Mi Perfil | `PerfilTab` | 4 secciones colapsables: Tu perfil (encuesta), Preferencias (temas/duracion/tono/voz), Generacion automatica (horario), Cuenta (email/logout). Barra de progreso de perfil. Guardado independiente por seccion. |

### 8.4 Onboarding — 4 pasos

El onboarding (`/onboarding`) guia al usuario en 4 pasos:

| Paso | Componente | Descripcion |
|------|-----------|-------------|
| 1. Encuesta | `StepSurvey` | Nombre*, edad, ciudad, rol, sector, nivel*, objetivo*, horario* |
| 2. Horario | `StepSchedule` | Hora de generacion, frecuencia (diario/laborables/custom), dias |
| 3. Temas | `StepTopics` | Seleccion de 3-5 temas de los 8 disponibles |
| 4. Config | `StepConfig` | Duracion (5/15/30 min), tono (casual/profesional/deep-dive), voz (femenina/masculina) |

### 8.5 Rutas protegidas y middleware

El archivo `proxy.ts` actua como middleware (convencion Next.js 16):
- **CSRF:** Valida Origin header en peticiones mutantes (POST/PUT/PATCH/DELETE) a `/api/*`
- **Sesion:** Refresca el token de Supabase en cada request
- **Rutas protegidas:** `/dashboard`, `/historial` → redirige a `/login` si no hay sesion
- **Redirect login:** Si el usuario logueado va a `/login` o `/signup` → redirige a `/dashboard`
- **Onboarding enforcement:** Si usuario autenticado va a ruta protegida sin cookie `wavecast_onboarding_complete` → redirige a `/onboarding`

### 8.6 Rate limiting

Las API routes tienen rate limiting en memoria (`lib/rate-limit.ts`):
- `POST /api/generate-podcast`: 10 peticiones por minuto por IP
- `POST /api/generate-audio`: 5 peticiones por minuto por IP
- Limpieza automatica de entradas caducadas cada 60 segundos
- Nota: en Vercel, cada instancia serverless tiene su propia memoria, por lo que el rate limit es por instancia

### 8.7 Seguridad

| Medida | Descripcion |
|--------|-------------|
| CSRF | Validacion de Origin header en proxy.ts para mutating requests |
| XSS | HTML sanitizado en renderMarkdown (escapeHtml) |
| RLS | Row Level Security en todas las tablas de usuario |
| Auth | Supabase Auth con JWT, refresh automatico en middleware |
| Input validation | Validacion estricta de topics, duration, tone, adjustments en API |
| Rate limiting | Por IP en API routes criticas |

### 8.8 Sistema de feedback y personalizacion

1. **Feedback explicito** (`episode-feedback.tsx` → `POST /api/feedback`):
   - Thumbs up (rating=5) / Thumbs down (rating=1)
   - Tags predefinidos (positivos: "Buen ritmo", "Temas interesantes", etc. / negativos: "Muy largo", "Demasiado basico", etc.)
   - Comentario opcional (max 200 chars)

2. **Metricas pasivas** (`POST /api/metrics`):
   - Tiempo total de escucha, tasa de completacion, velocidad de reproduccion

3. **User Insights** (`lib/user-insights.ts`):
   - Agrega feedback y metricas para inyectar en el prompt de Claude
   - Solo se activa con >= 3 feedbacks del usuario
   - Informa a Claude sobre: temas/tonos preferidos, tags mas comunes, tasa de escucha, velocidad habitual

### 8.9 Flujos de usuario

**Flujo A: Nuevo usuario (primera vez)**

```
1. Usuario abre la app
   └→ GET / → Landing page (hero, features, CTA)
   └→ Click "Empezar gratis" → /signup

2. Registro → email de confirmacion → /auth/callback → /onboarding

3. Onboarding - Paso 1: Encuesta personal ("Cuéntanos sobre ti")
   └→ Inputs: nombre*, edad, ciudad, rol, sector
   └→ Pickers: nivel_conocimiento* (principiante/intermedio/experto)
   └→           objetivo_podcast* (informarme/aprender/entretenerme)
   └→           horario_escucha* (mañana/mediodía/tarde/noche)
   └→ (* = obligatorio)

4. Onboarding - Paso 2: Horario de generacion
   └→ Hora exacta, frecuencia (diario/laborables/custom), dias
   └→ POST /api/schedule

5. Onboarding - Paso 3: Elegir temas
   └→ Selecciona 3-5 temas de los 8 disponibles

6. Onboarding - Paso 4: Configurar podcast
   └→ Elige duracion: 5 min (Express), 15 min (Estándar), 30 min (Deep Dive)
   └→ Elige tono: Casual, Profesional, Deep-dive
   └→ Elige voz: Femenina o Masculina
   └→ POST /api/profile + POST /api/preferences
   └→ Set cookie wavecast_onboarding_complete
   └→ Redirect a /onboarding/confirmacion

7. Confirmacion → Click "Generar mi primer podcast" → Redirect a /podcast

8. Generacion del podcast (pagina /podcast)
   └→ Proteccion doble-click: AbortController + boton deshabilitado
   └→ POST /api/generate-podcast con {topics, duration, tone}
      ├→ Validacion de inputs (topics, duration, tone, adjustments)
      ├→ Rate limiting (10 req/min por IP)
      ├→ fetchFromAgent(topics, duration) — selección inteligente (diversidad + sorpresa) + cache
      ├→ Si no hay suficientes: fallback a GNews API
      ├→ Fetch perfil del usuario (nombre, nivel, objetivo, horario)
      ├→ getUserInsights() — historial de feedback si hay >= 3
      ├→ trending_topics — top 3 temas trending del dia
      ├→ generateScript() — Claude genera guion con trending + sentiment + conexiones
      └→ Guarda episodio en Supabase

9. Resultado: guion renderizado + fuentes + BrowserAudioPlayer + EpisodeFeedback
   └→ Botones: Regenerar, Ajustar, Cambiar preferencias

10. Escuchar
    └→ Opcion A: Web Speech API (gratis, en tiempo real)
    └→ Opcion B: POST /api/generate-audio → ElevenLabs → MP3 → AudioPlayer
```

**Flujo B: Usuario recurrente**

```
1. Login → Supabase Auth → Auth callback con routing de 3 vias:
   ├→ Tiene preferences → /dashboard
   ├→ No tiene preferences → /onboarding (paso 1: temas)
   └→ No tiene survey → /onboarding

2. Dashboard - Tab Podcast: saludo contextual, episodio del dia, digest semanal, stats
   Dashboard - Tab Historial: lista con filtros (tema, tono, fecha) + busqueda full-text
   Dashboard - Tab Trending: top 10 temas trending con scores
   Dashboard - Tab Mi Perfil: 4 secciones (perfil+encuesta, preferencias, generacion automatica, cuenta)

3. Ajustar episodio: dialog con sugerencias rapidas + texto libre → regenera

4. Feedback: thumbs up/down + tags + comentario → mejora futuros episodios
```

**Flujo C: Middleware (en cada request)**

```
1. Cada peticion HTTP pasa por proxy.ts (convencion Next.js 16)
   └→ CSRF check en peticiones mutantes a /api/*
   └→ Refresca token de sesion de Supabase
   └→ Si ruta protegida (/dashboard, /historial) y no logueado:
      └→ Redirect a /login?redirect=/ruta-original
   └→ Si logueado y va a /login o /signup:
      └→ Redirect a /dashboard
   └→ Si logueado, ruta protegida y sin cookie wavecast_onboarding_complete:
      └→ Redirect a /onboarding
```

**Flujo D: Cron jobs automatizados**

```
1. 05:00 UTC — /api/cron/fetch-news: recopila noticias de 20 fuentes
2. 05:30 UTC — /api/cron/process-news: clasifica con Claude
3. 07:00 UTC — /api/cron/generate-scheduled: genera podcasts para usuarios con schedule activo
4. Domingos 03:00 UTC — /api/cron/cleanup: limpia noticias antiguas
5. Domingos 10:00 UTC — /api/cron/weekly-digest: genera digest semanal
```

---

## 9. Despliegue

| Componente | Plataforma | URL |
|------------|-----------|-----|
| Frontend + API + Cron | Vercel | https://podcast-ai-sigma.vercel.app |
| Base de datos | Supabase | `NEXT_PUBLIC_SUPABASE_URL` |
| Storage (audio) | Supabase Storage | Bucket `podcast-audio` |

**Vercel:**
- Project ID: `prj_YgUD18SkMpKPe4xkOxmqAs47uAlK`
- Org ID: `team_UnanlHXGfKm6eBPAdJNfbCMr`
- No hay dominio custom configurado
- Cron jobs configurados en `vercel.json` (5 tareas programadas)

**CI/CD:**
- GitHub repo: https://github.com/angideosuna/podcast-ai.git (rama `master`)
- Deploy manual con `npx vercel --prod`
- No hay pipelines custom, GitHub Actions, Docker, ni scripts de deploy dedicados

### 9.1 Como hacer deploy

```bash
# El deploy se hace automaticamente al hacer push a master
git push origin master

# O manualmente con Vercel CLI
npx vercel --prod
```

### 9.2 Variables de entorno en Vercel

Todas las variables de `.env.local` deben estar configuradas en el dashboard de Vercel:
Settings → Environment Variables. Incluir `CRON_SECRET` para autenticar los cron jobs.

### 9.3 Configuracion de Vercel

- **Framework:** Next.js (detectado automaticamente)
- **Build command:** `next build`
- **maxDuration:** 60s en `generate-audio/route.ts` (para que ElevenLabs tenga tiempo)
- **Cron jobs:** 5 tareas en `vercel.json` (ver seccion 7.2)

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
npm run agent:fetch     # Recopila noticias de 20 fuentes → raw_news
npm run agent:process   # Procesa batch de 40 raw → processed_news (Claude)
npm run agent:top       # Top 10 noticias mas relevantes de hoy
npm run agent:cleanup   # Limpia noticias antiguas de la base de datos
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
# Ejecutar las 10 migraciones en el SQL Editor de Supabase:
# supabase/migrations/001_initial_schema.sql
# supabase/migrations/002_add_voice_to_preferences.sql
# supabase/migrations/003_add_survey_fields.sql
# supabase/migrations/004_news_agent_tables.sql
# supabase/migrations/005_add_schedule_fields.sql
# supabase/migrations/006_schedules.sql
# supabase/migrations/007_feedback_and_metrics.sql
# supabase/migrations/008_shared_episodes.sql
# supabase/migrations/009_fulltext_search_episodes.sql
# supabase/migrations/010_enhanced_classification.sql

# 5. Arrancar el servidor
npm run dev
# Abre http://localhost:3000
```

### 10.3 Ejecutar el agente

```bash
# Recopilar noticias (ejecutar periodicamente, o dejar que Vercel Cron lo haga)
npm run agent:fetch

# Procesar con IA (ejecutar despues de fetch)
npm run agent:process

# Ver las mejores noticias
npm run agent:top
```

### 10.4 Generar un podcast

1. Abrir `http://localhost:3000`
2. Registrarse y completar el onboarding (4 pasos: encuesta + horario + temas + config)
3. En la pantalla de confirmacion, clic "Generar mi podcast"
4. La app consulta `processed_news` (o GNews como fallback), Claude genera el guion
5. Clic "Escuchar" para Web Speech API o "Generar audio" para ElevenLabs
6. Dejar feedback (thumbs up/down + tags) para mejorar futuros episodios

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
| Landing page publica con hero, features y CTA | OK |
| Registro e inicio de sesion (email/password) | OK |
| Onboarding simplificado (2 pasos: temas + config) | OK |
| Encuesta personal (nombre, edad, ciudad, nivel, objetivo, horario) | OK |
| Horario de generacion automatica (diario/laborables/custom) | OK |
| News Agent con 20 fuentes (19 RSS + NewsAPI) | OK |
| Automatizacion con Vercel Cron (5 tareas programadas) | OK |
| Deduplicacion v2: titulo + descripcion + stopwords + cross-temporal 24h | OK |
| Clasificacion enriquecida con Claude (sentiment, impact_scope, story_id) | OK |
| Batch upsert en raw_news | OK |
| Generacion de guion con Claude (trending, sentiment, conexiones, sorpresa, story grouping) | OK |
| User insights basados en feedback/metricas inyectados en prompt | OK |
| Cache en memoria para articulos (TTL 1 hora) | OK |
| Retry con backoff exponencial para APIs externas | OK |
| Validacion estricta de inputs en API (topics, duration, tone, adjustments) | OK |
| Proteccion doble-click con AbortController | OK |
| Proteccion CSRF en proxy.ts (Origin header validation) | OK |
| Reproduccion con Web Speech API (fallback TTS) | OK |
| Generacion de audio con ElevenLabs | OK |
| Reproductor de audio completo (play, pause, seek, velocidad) | OK |
| Ajustar/regenerar episodio con instrucciones | OK |
| Dashboard con 4 tabs (Hoy, Historial, Descubrir, Mi Perfil) | OK |
| Historial con filtros (tema, tono, fecha) y busqueda full-text | OK |
| Full-text search con tsvector + GIN index + RPC search_episodes() | OK |
| Trending topics (tab en dashboard con top 10 temas del dia) | OK |
| Feedback de episodios (thumbs up/down + tags + comentario) | OK |
| Metricas de escucha pasivas (completion rate, playback speed) | OK |
| Compartir episodios publicamente (/shared/[id]) | OK |
| Digest semanal automatico (cron domingos) | OK |
| Paginacion en historial (10 por pagina, "Cargar mas") | OK |
| Edicion de perfil | OK |
| PWA manifest con instalacion nativa | OK |
| Estetica Spotify (negro + verde #1DB954, cards flat, sin glass) | OK |
| Tipografia Montserrat para headings (h1/h2) | OK |
| Markdown renderer (tema oscuro, HTML sanitizado) | OK |
| Emoji removal universal (regex Unicode) en TTS | OK |
| Sanitizacion de newlines en prompt | OK |
| Logger profesional con contexto y colores | OK |
| Tipos centralizados | OK |
| getTopicById utility (evita TOPICS.find repetido) | OK |
| Constante ARTICLES_BY_DURATION compartida | OK |
| Estructura narrativa con arco (gancho/desarrollo/respiro/climax/cierre) | OK |
| Profundidad informativa adaptada por duracion (5/15/30 min) | OK |
| Ritmo y energia variable dentro del episodio | OK |
| Saludo personalizado por nombre al inicio del podcast | OK |
| TOPIC_TO_CATEGORIES centralizado en lib/topics.ts | OK |
| Cliente Supabase reutilizado en route | OK |
| Log warning en profile catch (no silencioso) | OK |
| JSON.parse seguro en localStorage | OK |
| Response.ok antes de JSON parse | OK |
| Rate limiting en API routes (por IP) | OK |
| Selección inteligente de artículos (diversidad temas/fuentes, keyword dedup, sorpresa, story grouping) | OK |
| max_tokens dinamico segun duracion (4096/8192/12288) | OK |
| Timeout de 55s en llamadas a Claude (AbortController) | OK |
| Cliente Anthropic singleton (reutilizado entre peticiones) | OK |
| Script de limpieza de noticias antiguas (agent:cleanup) | OK |
| HTML sanitizado en renderMarkdown (prevencion XSS) | OK |
| Middleware activo (proxy.ts, convencion Next.js 16) | OK |
| Onboarding enforcement via cookie en middleware | OK |
| Accesibilidad ARIA en tab bar del dashboard | OK |
| Trending clips de 5 min (top 5 temas polemicos, cache diario, thundering herd) | OK |
| Clip audio player inline (sin metricas, voz femenina por defecto) | OK |
| Tab Hoy: generacion integrada en dashboard (sin pagina /podcast separada) | OK |
| Tab Descubrir: todos los trending topics con generacion de clips | OK |
| /podcast → redirect automatico a /dashboard | OK |
| Build de produccion | OK |

### 11.2 Changelog

**v17.3 — Limpieza final de reestructuracion UI:**
- Eliminados step-survey.tsx y step-schedule.tsx (logica ya migrada a perfil-tab.tsx, no se importaban)
- app/onboarding/confirmacion/ ya no existia (eliminada en v15)
- app/podcast/page.tsx ya era redirect a /dashboard (sin cambios)
- Onboarding queda con 2 componentes: step-topics.tsx + step-config.tsx
- Build limpio, 0 imports rotos, 0 archivos muertos

**v17.2 — Limpieza de navegacion y middleware:**
- proxy.ts: eliminado /podcast de protectedPaths (ya es solo un redirect a /dashboard)
- auth/callback/route.ts: simplificado flujo post-login — solo comprueba preferences (ya no consulta survey_completed)
- auth/callback: eliminado redirect a /onboarding?step=2 (el paso 1 ahora es temas, no encuesta)
- nav-header.tsx y app/page.tsx ya estaban correctos (sin cambios)
- Sin referencias stale a PodcastTab, TrendingTab o "Trending" en codigo

**v17.1 — Sugerencia de horario automatico post-generacion:**
- hoy-tab.tsx: banner de sugerencia de schedule tras generar podcast exitosamente
- Condiciones: sin schedule activo + mostrado < 3 veces (localStorage wavecast_schedule_prompt_count)
- Boton "Activar podcast diario a las 8:00" → POST /api/schedule (daily, 08:00, is_active:true)
- Link "Personalizar horario" → cambia a tab Mi Perfil (seccion Generacion automatica)
- Boton X para descartar (incrementa contador en localStorage, max 3 dismissals)
- Confirmacion inline: "Listo. Mañana a las 8:00 tendras tu podcast esperandote"
- Animacion fade-in + slide-up con tw-animate-css (animate-in fade-in slide-in-from-bottom-2)
- Aparece con delay de 800ms tras fase "done", card con borde verde sutil (border-forest/20)

**v17 — Tab Mi Perfil ampliado con encuesta + horario + preferencias:**
- perfil-tab.tsx reescrito: 4 secciones colapsables con guardado independiente
- Seccion A "Tu perfil": nombre, edad (select), ciudad, rol, sector (select), nivel de conocimiento (OptionPicker), objetivo del podcast (OptionPicker), horario de escucha (OptionPicker)
- Seccion B "Preferencias de podcast": temas (CategoryCard + OtrosSection), duracion (DurationPicker), tono (TonePicker), voz (VoicePicker)
- Seccion C "Generacion automatica": toggle activar/desactivar, hora (input time), periodicidad (pills), dias personalizados (botones circulares L-D)
- Seccion D "Cuenta": email (solo lectura) + cerrar sesion
- Barra de progreso de perfil (11 campos, se oculta al 100%)
- Mapeo bidireccional UI↔API: periodicidad (todos-los-dias↔daily, lunes-a-viernes↔weekdays, personalizado↔custom), dias (L→1, M→2, X→3, J→4, V→5, S→6, D→0)
- Reutiliza 6 componentes existentes: OptionPicker, DurationPicker, TonePicker, VoicePicker, CategoryCard, OtrosSection
- hoy-tab.tsx: banner "Completa tu perfil" cuando survey_completed=false, con boton que cambia a tab Mi Perfil
- dashboard/page.tsx: estado surveyCompleted, query ampliada a "nombre, survey_completed", callbacks switchToPerfil + handleSurveyChange
- Al guardar perfil con nivelConocimiento + objetivoPodcast → survey_completed=true automaticamente
- Sin archivos nuevos: 3 archivos modificados

**v16 — Fusion de /podcast en dashboard como tab "Hoy":**
- Nueva tab "Hoy" (hoy-tab.tsx): fusiona generacion de podcast + vista dashboard en un solo componente
- Estado idle: saludo, episodio de hoy (si existe), digest semanal, ultimos episodios, stats, PWA install
- Estado generando: animacion loading con fases (noticias → guion → listo)
- Estado done: script renderizado, fuentes, feedback, regenerar/ajustar/compartir, audio player
- Estado error: mensaje + reintentar/volver
- Tab "Podcast" → renombrada a "Hoy" (icono Mic, emoji headphones)
- Tab "Trending" → renombrada a "Descubrir" (icono Compass, emoji lupa)
- descubrir-tab.tsx: todos los trending topics ahora pueden generar clips (no solo top 5)
- Seccion "Mas trending" convertida de Link cards a clip-capable cards (antes enlazaban a /podcast)
- app/podcast/page.tsx: convertida a redirect simple a /dashboard
- Eliminados componentes obsoletos: podcast-tab.tsx, trending-tab.tsx
- historial-tab.tsx: referencia /podcast actualizada a /dashboard
- onEpisodeGenerated callback: notifica al dashboard cuando se genera episodio (actualiza recentEpisodes)
- proxy.ts: /podcast eliminado de rutas protegidas en v17.2 (es solo redirect a /dashboard)

**v15 — Reestructuracion onboarding de 4 pasos a 2:**
- Paso 1: Seleccion de temas (era paso 3) — titulo motivador "¿Que te interesa?"
- Paso 2: Config rapida (duracion + tono + voz + nombre) — boton "Crear mi podcast"
- Eliminada pagina /onboarding/confirmacion — redireccion directa a /dashboard
- step-survey.tsx y step-schedule.tsx se mantenian como reservados; eliminados en v17.3 (logica migrada a perfil-tab)
- Nombre del usuario se guarda via POST /api/profile (solo campo nombre)
- Preferencias + nombre se guardan en paralelo al finalizar
- Barra de progreso muestra 2 pasos en vez de 4
- Boton "Atras" condicional en step-topics (no aparece en paso 1)
- Estado "saving" con spinner en boton final para evitar doble-click
- Referencias a /onboarding/confirmacion actualizadas en podcast/page.tsx

**v14 — 7 mejoras de calidad de contenido, narracion e informacion:**
- Clasificador (classifier.ts): resumenes RICOS (3-4 frases con cifras, nombres, impacto), max_tokens 3072→4096
- Clasificador: instrucciones especificas para noticias en ingles (nombres propios, fuente, terminologia bilingue, contexto cultural)
- generate-script.ts: nuevo bloque DATOS QUE IMPACTAN — ancla cada noticia con dato sorprendente (comparacion visual, perspectiva, pregunta retorica, contraste temporal)
- generate-script.ts: pool de 6 FORMATOS DE EPISODIO aleatorios (clasico, lo mejor/peor, debate interno, countdown, hilo conductor, pregunta del dia)
- generate-script.ts: bloque ANTI-REPETICION — consulta ultimos 2 episodios del usuario, evita repetir noticias ya cubiertas
- user-insights.ts: incluye titulos de los 3 episodios favoritos (rating=5) del usuario para mantener estilo que funciono
- tts-utils.ts: nueva funcion enhanceProsody() — micro-pausas antes de datos impactantes, enfasis en preguntas retoricas, normalizacion de numeros grandes
- Pipeline ElevenLabs: cleanScriptForTTS → enhanceProsody → preprocessForTTS
- generate-podcast.ts: query de episodios previos en paralelo con Promise.allSettled (4 queries simultaneas)

**v13 — Optimizacion de rendimiento a fondo:**
- Dashboard: lazy loading de 4 tabs con dynamic() + ssr:false (code splitting)
- Dashboard: trending fetch movido al Promise.all inicial (elimina cascada)
- Dashboard: useMemo/useCallback para evitar re-renders innecesarios
- generate-podcast.ts: 3 queries DB (profile, insights, trending) en paralelo con Promise.allSettled
- get-articles.ts: queries candidatos + sorpresa en paralelo con Promise.all (elimina 2a query secuencial)
- Trending-tab: cache checks batcheados con Promise.all + single setState (era forEach async)
- Historial-tab: fetch de preferences separado en useEffect unico (no se repite en cada filtro)
- Cache headers HTTP: trending (public, s-maxage=3600), clips (public, s-maxage=3600), profile/preferences (private, max-age=300)
- Singleton Supabase clients en API routes (trending, clips) — evita recrear en cada request
- Fonts: display:"swap" en Inter, Montserrat, Geist Mono para FOIT→FOUT

**v12 — Saludo personalizado en el podcast:**
- Saludo calido por nombre del oyente (profile.nombre) al inicio del podcast
- Adaptado por horario (manana/noche), tono (casual/profesional/deep-dive) y variabilidad
- Si no hay nombre en el perfil, saludo generico cercano
- Integrado con la estructura narrativa: saludo → gancho → desarrollo

**v11 — Mejora narrativa del guion de podcast:**
- Estructura narrativa con arco: gancho → desarrollo → respiro → climax → cierre con gancho
- Profundidad informativa adaptada por duracion: 5min (que+porque), 15min (+contexto), 30min (+prediccion)
- Bloque de ritmo y energia: variacion de intensidad, pausas dramaticas, segunda persona
- Aperturas mejoradas: 8 estilos (dato numerico, prediccion, contraste, anecdota...)
- Transiciones mejoradas: 8 estilos (causa-efecto, temporal, geografico, humor/ironia...)
- Cierres mejorados: 6 estilos (arco circular, prediccion, pregunta abierta, bomba final...)
- Noticias con mas contexto: keywords, sentimiento+alcance en linea, resumen extendido (300 chars)
- Campo `keywords` propagado: Article type → get-articles.ts → prompt de generacion
- Tratamiento contextualizado de sentiment: negative → perspectiva, positive → matices

**v10 — Trending Clips (clips de 5 min sobre temas polemicos):**
- Tabla `trending_clips` (migracion 011): cache diario por topic con status generating/ready/error
- `lib/generate-clip.ts`: busca articulos por topic en processed_news (48h, top 2) y genera script de 5 min
- `lib/generate-script.ts`: soporte duracion 5 min (2 articulos, 4096 tokens, 20s intro/cierre)
- `app/api/clips/route.ts`: GET (consultar estado) + POST (generar/recuperar) con thundering herd + rate limit 5/min
- `components/clip-audio-player.tsx`: reproductor inline (no fixed-bottom), sin metricas, voz femenina por defecto
- `components/dashboard/trending-tab.tsx`: seccion "Clips del dia" (top 5 excluyendo entertainment/sports) + "Mas trending" (resto)
- Flujo: primer usuario genera clip → los siguientes lo obtienen cacheado (mismo dia)
- Badges rojo/naranja para clips (temas polemicos), verde para trending normal
- Card expandible con preview del script (fade), player inline y fuentes

**v9 — Ampliacion de fuentes + deduplicador v2 + clasificacion enriquecida:**
- sources.json v2.0: formato plano `{sources: [...]}` con campo `type` (antes `{rss: [], apis: []}`)
- 19 feeds RSS (antes 8): +11 fuentes nuevas en espanol (elDiario.es, 20 Minutos, El Mundo, El Espanol x2, Europa Press, Genbeta, Newtral, Expansion, Google News IA, Google News Startups)
- batch_size de procesamiento: 20 → 40 (agent-config.json)
- Timeout RSS: 10s → 15s para feeds mas lentos
- User-Agent: `PodcastAI-NewsAgent/1.0` → `WaveCast-NewsAgent/2.0`
- TOPIC_TO_CATEGORIES: politica-actualidad ahora mapea a `["politics", "general"]` (mas cobertura)
- Tipos actualizados: `SourceConfig` union type, `SourcesConfig` con metadata (version, description)
- `sources/index.ts` refactorizado para array plano con filtro por `type`
- Deduplicador v2: compara titulo (>70%) Y descripcion (>60%), con stopwords es+en
- Dedup cross-temporal: segunda pasada contra processed_news de ultimas 24h
- Al encontrar duplicados, se queda con el articulo de descripcion mas larga
- Pipeline actualizado: pasa cliente Supabase al deduplicador para cross-temporal
- Tests del deduplicador actualizados para nueva API async + nuevos test cases
- Clasificacion enriquecida: 3 nuevos campos en processed_news (sentiment, impact_scope, story_id)
- Migration 010: ALTER TABLE + CHECK constraints + indices parciales (story_idx, sentiment_idx)
- Prompt del clasificador ampliado con instrucciones detalladas para los 3 nuevos campos
- max_tokens del clasificador: 4096 → 3072 (optimizado para 9 campos por articulo)
- Validacion robusta de los 9 campos con defaults (sentiment→neutral, impact_scope→national, story_id→uncategorized)
- story_id: kebab-case, max 50 chars, agrupa noticias del mismo tema entre batches
- Selección inteligente de artículos (`get-articles.ts` reescrito):
  - Paso A: trae 3x candidatos (ARTICLES_BY_DURATION × 3) ordenados por relevancia
  - Paso B: garantiza 1 noticia top por cada topic del usuario (diversidad temática)
  - Paso C: max 2 noticias por fuente (diversidad de fuente)
  - Paso D: descarta noticias con >50% keyword overlap (evita repetición)
  - Paso E: añade 1 noticia sorpresa fuera de categorías del usuario (relevance >= 8)
  - Paso F: agrupa por story_id con campo `related_articles` para narración consolidada
- `fetchFromAgent(topics, duration)` — nueva firma, usa ARTICLES_BY_DURATION internamente
- Tipo `Article` ampliado con `related_articles?: { title: string; summary: string }[]`
- `GeneratePodcastResult.articles` usa tipo `Article` (antes inline type)
- Prompt de guiones mejorado (v3): 4 nuevos bloques contextuales
  - Bloque A: trending topics del dia (top 3 de trending_topics, consultados desde generate-podcast.ts)
  - Bloque B: instruccion de conexiones entre noticias (transiciones naturales en vez de bloques aislados)
  - Bloque C: tono por noticia (sentiment→energia, impact_scope→alcance)
  - Bloque D: noticias relacionadas por story_id ([RELACIONADAS: ...] en el prompt)
- Pool SURPRISE_INTROS (4 frases) para introducir la noticia sorpresa del paso E
- Noticias en el prompt ahora incluyen sentiment, impact_scope y [RELACIONADAS] tags
- `generateScript()` acepta 2 nuevos parametros: `trending` y `userTopics`
- `generate-podcast.ts` consulta trending_topics del dia antes de generar guion
- Tipo `Article` ampliado con `sentiment`, `impact_scope` y `category` opcionales
- `get-articles.ts` pasa sentiment, impact_scope y category desde ProcessedNewsItem a Article

**v8 — Estetica Spotify + reestructuracion de componentes:**
- Paleta de colores: navy/cyan → negro puro (#000000) + verde Spotify (#1DB954)
- Cards: glassmorphism (backdrop-blur) → flat opacos (bg-[#121212], sin blur)
- Inputs: bg transparente con blur → bg solido (#282828) con focus verde
- Nav, tab bar, player: fondos solidos (bg-black) sin blur
- Tipografia: Montserrat (Google Fonts) para headings h1/h2 (weights 600/700/800)
- PWA manifest actualizado con colores Spotify
- Dashboard split: 1 archivo de 649 lineas → 5 archivos (163 + 4 tabs)
- Onboarding split: 1 archivo de 764 lineas → 5 archivos (434 + 4 steps)
- Landing page: hero, features, CTA con estetica oscura
- Correccion de ~42 tildes en textos en espanol (sesion, dia, mas, etc.)
- Error handling mejorado en episode-feedback y adjust-episode
- Accesibilidad: ARIA tablist/tab/tabpanel en dashboard tabs

**v7 — Nuevas features y automatizacion:**
- Vercel Cron: 5 tareas programadas (fetch, process, generate, cleanup, digest)
- Tabla schedules: horarios de generacion automatica por usuario
- Feedback de episodios: thumbs up/down + tags + comentario
- Metricas de escucha: completion rate, playback speed
- User insights: inyeccion de historial de preferencias en prompt de Claude
- Compartir episodios: pagina publica /shared/[id]
- Full-text search: tsvector con config 'spanish' + indice GIN + RPC
- Historial con filtros (tema, tono, fecha) y busqueda integrada
- Trending topics: tab en dashboard con datos de trending_topics
- Cache en memoria para articulos (TTL 1 hora)
- Retry con backoff exponencial (lib/retry.ts)
- CSRF protection en proxy.ts (Origin header validation)
- Onboarding enforcement: cookie wavecast_onboarding_complete
- Logica de generacion extraida a lib/generate-podcast.ts (compartida con cron)
- Sugerencias de temas basadas en tendencias (POST /api/suggest-topics)
- 5 nuevas migraciones (005-009)

**v6 — Seguridad, rendimiento, robustez y observabilidad:**
- Middleware restaurado y activo (proxy.ts, convencion Next.js 16)
- Rate limiting en API routes (10/min podcast, 5/min audio, por IP)
- Filtro de 48h en fetchFromAgent (solo noticias frescas) — ahora con selección inteligente (v9)
- max_tokens dinamico segun duracion (4096/8192/12288)
- Timeout de 55s en llamadas a Claude (AbortController)
- Script de limpieza de noticias antiguas (agent:cleanup)
- HTML sanitizado en renderMarkdown (escapeHtml, prevencion XSS)
- Paginacion en historial (10 por pagina, "Cargar mas")
- TOPIC_TO_CATEGORIES centralizado en lib/topics.ts
- Cliente Anthropic singleton (reutilizado entre peticiones)

**v5 — Bug fixes, validacion, robustez y calidad de codigo:**
- Markdown renderer: colores tema oscuro → tema claro (text-stone-*)
- response.ok antes de JSON parse (evita crash con error no-JSON)
- JSON.parse seguro en localStorage (try-catch con fallback)
- Validacion estricta de inputs en API (topics, duration, tone, adjustments)
- Proteccion doble-click con AbortController + isGenerating flag
- Cliente Supabase reutilizado en route (1 en vez de 2)
- Batch upsert en saveRawNews (1 query en vez de N+1)
- Retry con backoff en clasificador (1 reintento, 3s delay)
- JSON parsing robusto en clasificador (objetos sueltos, trailing commas, defaults)
- Emoji removal universal (regex Unicode en vez de lista hardcodeada)
- getTopicById() centralizado (en vez de TOPICS.find() repetido en 5+ archivos)
- Sanitizacion de newlines en prompt (titulo y descripcion de articulos)
- Log warning en profile catch (en vez de catch silencioso)

### 11.3 A medias / con limitaciones

| Feature | Estado |
|---------|--------|
| Concatenacion de MP3 cruda | Los chunks de audio se concatenan byte a byte. Puede causar glitches en los cortes. Lo correcto seria usar un muxer MP3. |
| Rate limiting en memoria | Funciona por instancia serverless en Vercel (no compartido entre instancias). Para produccion robusta seria mejor Redis. |

### 11.4 TODO — Pendiente

| Tarea | Prioridad |
|-------|-----------|
| Tests unitarios (al menos newsapi.ts, generate-script.ts, elevenlabs.ts) | Media |
| Dominio custom (solo tiene el dominio automatico de Vercel) | Baja |
| Muxer MP3 para concatenacion correcta de chunks | Baja |
| Rate limiting persistente (Redis) para Vercel multi-instancia | Baja |
| Notificaciones push al generar podcast programado | Baja |
| Dashboard de admin para monitorizar health de fuentes | Baja |

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

---

## Apendice: Credenciales

Todas las cuentas estan creadas y configuradas en `.env.local`:

| Servicio | Estado | Plan | Donde obtenerla |
|----------|--------|------|-----------------|
| **Supabase** | Configurado | Gratis | https://supabase.com |
| **Anthropic** | Configurado | De pago | https://console.anthropic.com |
| **ElevenLabs** | Configurado | De pago | https://elevenlabs.io |
| **GNews** | Configurado | Gratis (100 req/dia) | https://gnews.io |
| **NewsAPI.org** | Configurado | Gratis (100 req/dia) | https://newsapi.org |
| **Vercel** | Configurado | Gratis | https://vercel.com |

Para clonar el proyecto: copiar `.env.example` a `.env.local`, rellenar los valores, y ejecutar las 11 migraciones SQL en el editor de Supabase.
