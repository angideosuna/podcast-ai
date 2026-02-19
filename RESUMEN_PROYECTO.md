# RESUMEN COMPLETO DEL PROYECTO — PodCast.ai

> Ultima actualizacion: 19 de febrero de 2026 (v5 — Bug fixes, validacion, robustez y calidad de codigo)

---

## 1. Resumen general

### Que hace la app

**PodCast.ai** es una aplicacion web que genera podcasts diarios personalizados con voces AI. El usuario completa una encuesta personal (nombre, nivel, objetivo, horario), elige sus temas de interes, duracion, tono y voz preferida. Un **News Agent** autonomo recopila y clasifica noticias de multiples fuentes (RSS + NewsAPI) con IA, y la app genera un guion conversacional adaptado al perfil del oyente y lo convierte en audio con voz natural.

### Flujo resumido

```
News Agent recopila noticias (RSS + NewsAPI) → Clasifica con Claude → Usuario genera podcast → App consulta processed_news → Claude genera guion personalizado → ElevenLabs genera audio → Usuario escucha
```

### Stack tecnico

| Capa | Tecnologia | Version |
|------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Frontend | React + Tailwind CSS + shadcn/ui | React 19.2.3, Tailwind 4 |
| Lenguaje | TypeScript | 5.x (strict mode) |
| Backend | Next.js API Routes | Incluido en Next.js |
| Base de datos | Supabase (PostgreSQL) | SDK 2.97.0 |
| Autenticacion | Supabase Auth | SDK @supabase/ssr 0.8.0 |
| Almacenamiento | Supabase Storage | Bucket `podcast-audio` |
| News Agent | Agente autonomo (RSS + NewsAPI + Claude) | Custom |
| Noticias (fallback) | GNews API | v4 |
| IA / Guiones | Claude API (Anthropic SDK) | SDK 0.76.0, modelo `claude-sonnet-4-20250514` |
| Audio / TTS | ElevenLabs API | Modelo `eleven_multilingual_v2` |
| Audio / Fallback | Web Speech API (nativa del navegador) | Sin dependencia |
| Deploy | Vercel | Proyecto `podcast-ai` |
| Iconos | Lucide React | 0.574.0 |
| UI Components | Radix UI (via shadcn) | 1.4.3 |

---

## 2. Servicios externos y APIs

### 2.1 News Agent — Fuente principal de noticias

| Campo | Valor |
|-------|-------|
| Para que se usa | Recopilar, deduplicar y clasificar noticias de multiples fuentes con IA |
| Directorio | `src/agents/news-agent/` |
| Fuentes | 8 feeds RSS (BBC, Guardian, El Pais, BBC Mundo, Xataka) + NewsAPI.org |
| Clasificacion | Claude Sonnet 4 (batches de 10 articulos) |
| Almacenamiento | Supabase: `raw_news` → `processed_news` |
| Variables de entorno | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEWSAPI_KEY` |

**Pipeline del agente:**

```
RSS feeds + NewsAPI → raw_news (Supabase) → deduplicacion (70% overlap) → clasificacion con Claude → processed_news
```

**Categorias del agente:** technology, science, business, health, entertainment, sports, politics, general

**Mapeo de topics del usuario a categorias del agente:**

| Topic usuario | Categoria(s) en processed_news |
|---|---|
| tecnologia | technology |
| inteligencia-artificial | technology, science |
| ciencia | science |
| politica | politics |
| economia | business |
| startups | business, technology |
| salud | health |
| cultura | entertainment |

**Archivos clave del agente:**

| Archivo | Funcion |
|---------|---------|
| `storage/supabase.ts` | Cliente Supabase (service_role), CRUD de raw_news, processed_news, sources_health. **Batch upsert** para raw_news (una sola query en vez de N+1). |
| `storage/get-articles.ts` | `fetchFromAgent()` — consulta processed_news y devuelve `Article[]` para el podcast |
| `sources/rss.ts` | Parser RSS/Atom generico |
| `sources/newsapi.ts` | Integracion con NewsAPI.org |
| `processors/classifier.ts` | Clasificacion con Claude (categoria, relevance_score 1-10, summary, keywords). **Retry con backoff** (3s) si un batch falla. **JSON parsing robusto**: maneja objetos sueltos, trailing commas y valida campos con defaults. |
| `processors/deduplicator.ts` | Deteccion de duplicados por similitud de titulo (>70% overlap) |
| `scripts/fetch.ts` | CLI: `npm run agent:fetch` |
| `scripts/process.ts` | CLI: `npm run agent:process` |
| `scripts/top.ts` | CLI: `npm run agent:top [fecha]` |

**Scripts del agente:**

```bash
npm run agent:fetch     # Recopila noticias de todas las fuentes → raw_news
npm run agent:process   # Procesa batch de 20 noticias raw → processed_news
npm run agent:top       # Muestra top 10 noticias mas relevantes
```

### 2.2 GNews API — Fallback de noticias

| Campo | Valor |
|-------|-------|
| Para que se usa | **Fallback** cuando el News Agent no tiene suficientes articulos |
| Endpoint | `https://gnews.io/api/v4/search` |
| Archivo | `lib/newsapi.ts` |
| Variable de entorno | `GNEWS_API_KEY` |
| Plan actual | Gratis (100 peticiones/dia, max 10 resultados por query) |
| Idioma de busqueda | Espanol (`lang=es`) |

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

### 2.3 Claude API (Anthropic) — Generacion de guiones

| Campo | Valor |
|-------|-------|
| Para que se usa | Generar el guion conversacional del podcast a partir de las noticias |
| Libreria | `@anthropic-ai/sdk` v0.76.0 |
| Modelo | `claude-sonnet-4-20250514` |
| Max tokens | 8192 |
| Archivo | `lib/generate-script.ts` |
| Variable de entorno | `ANTHROPIC_API_KEY` |

**Como funciona:**
1. Recibe las noticias filtradas por el News Agent (o GNews como fallback)
2. Usa un **system prompt** con personalidad de podcaster real (identidad, expresiones, reglas de oro, frases prohibidas)
3. Construye un prompt con: noticias (con newlines sanitizados en titulo y descripcion), instrucciones de tono detalladas (con ejemplos DO/DON'T), y variaciones aleatorias
4. Si el usuario tiene perfil, inyecta un bloque `## PERFIL DEL OYENTE` con instrucciones contextuales (nombre, nivel, objetivo, horario)
5. Claude genera un guion en Markdown con estilo narrativo/storytelling adaptado al perfil
6. Calcula tiempos por seccion segun duracion (160 palabras = 1 minuto de audio)

**Constante compartida:** `ARTICLES_BY_DURATION` (exportada desde `generate-script.ts`) define cuantas noticias usar por duracion: `{5: 3, 15: 5, 30: 8}`. Se reutiliza en la API route para evitar duplicacion.

**Sistema de prompts (v2):**

| Componente | Descripcion |
|-----------|-------------|
| System prompt | Personalidad de podcaster: curioso, apasionado, cercano. Expresiones naturales del espanol de Espana. 15 frases prohibidas que suenan a IA. |
| Tone instructions | Instrucciones detalladas por tono con ejemplos concretos de COMO SI y COMO NO debe sonar. |
| Variabilidad | Pools aleatorios: 6 estilos de apertura, 5 de transicion, 5 de cierre. Cada episodio suena diferente. |
| Estructura | Flexible, no rigida. Storytelling libre en vez de "Titular → Contexto → Opinion". |
| Perfil del oyente | Bloque contextual inyectado despues de REGLAS INQUEBRANTABLES. Adapta nivel (principiante→explicar conceptos, experto→terminologia tecnica), objetivo (informar→resumen claro, entretener→contenido dinamico), y horario (manana→energia, noche→relajado). |

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

### 2.4 ElevenLabs — Text-to-Speech

| Campo | Valor |
|-------|-------|
| Para que se usa | Convertir el guion de texto en audio MP3 con voz natural |
| Endpoint | `https://api.elevenlabs.io/v1/text-to-speech/{voice_id}` |
| Modelo | `eleven_multilingual_v2` |
| Archivo | `lib/elevenlabs.ts` |
| Variables de entorno | `ELEVENLABS_API_KEY` (obligatoria para TTS), `ELEVENLABS_VOICE_ID` (opcional) |

**Voces configuradas:**

| Genero | Voice ID | Nombre |
|--------|----------|--------|
| Femenina (default) | `pFZP5JQG7iQjIQuC4Bku` | Lily |
| Masculina | `onwK4e9ZLuTAKqWW03F9` | Daniel |

**Parametros de voz:**
- Stability: 0.5
- Similarity boost: 0.75
- Style: 0.3
- Speaker boost: activado
- Idioma: `es` (espanol)

**Limite por peticion:** 5000 caracteres. Si el guion es mas largo, se divide en fragmentos y se concatenan los buffers de audio.

### 2.5 Web Speech API — Fallback gratuito de TTS

| Campo | Valor |
|-------|-------|
| Para que se usa | Alternativa gratuita cuando no hay ElevenLabs configurado |
| Archivo | `components/browser-audio-player.tsx` |
| Variables de entorno | Ninguna (API nativa del navegador) |

**Como funciona:**
- Usa `SpeechSynthesis` del navegador
- Busca voces en `es-ES` (espanol de Espana)
- En Windows busca: Microsoft Helena (femenina), Microsoft Pablo (masculina)
- Play/Pause/Stop con controles propios
- No genera archivo MP3, solo reproduce en tiempo real

### 2.6 Supabase — Base de datos, Auth y Storage

| Campo | Valor |
|-------|-------|
| Para que se usa | Todo el backend: usuarios, perfiles, preferencias, episodios, audio |
| URL del proyecto | Configurado en `NEXT_PUBLIC_SUPABASE_URL` |
| Archivos | `lib/supabase/client.ts` (navegador), `lib/supabase/server.ts` (servidor) |
| Variables de entorno | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

**Servicios usados:**
1. **Supabase Auth**: Registro, login, sesiones, confirmacion por email
2. **Supabase PostgreSQL**: Tablas profiles, preferences, episodes
3. **Supabase Storage**: Bucket `podcast-audio` para archivos MP3
4. **Supabase RLS**: Row Level Security en todas las tablas

### 2.7 Vercel — Hosting y deploy

| Campo | Valor |
|-------|-------|
| Para que se usa | Hosting de la aplicacion Next.js |
| Project ID | `prj_YgUD18SkMpKPe4xkOxmqAs47uAlK` |
| Org ID | `team_UnanlHXGfKm6eBPAdJNfbCMr` |
| Nombre del proyecto | `podcast-ai` |
| Archivo config | `.vercel/project.json` |
| Limite API routes | 60 segundos (`maxDuration` en generate-audio) |

### 2.8 Servicios configurados pero NO usados activamente

| Servicio | Estado |
|----------|--------|
| `ELEVENLABS_VOICE_ID` (env var) | Declarado pero el codigo prioriza las voces segun preferencia del usuario. Solo se usa si esta configurado Y el usuario no elige voz. |

---

## 3. Base de datos

### Plataforma
PostgreSQL alojado en **Supabase** (plan gratis).

### Migrations
- `supabase/migrations/001_initial_schema.sql` — Schema inicial (profiles, preferences, episodes, storage)
- `supabase/migrations/002_add_voice_to_preferences.sql` — Campo voice en preferences
- `supabase/migrations/003_add_survey_fields.sql` — Campos de encuesta personal en profiles

### Tablas

#### 3.1 `profiles` — Datos del usuario

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID (PK) | Referencia a `auth.users`, CASCADE |
| nombre | text | Nombre del usuario |
| empresa | text | Empresa donde trabaja |
| rol | text | Rol profesional (CEO, CTO, etc.) |
| sector | text | Sector (Tech, Finanzas, Salud, etc.) |
| edad | text | Edad o rango de edad ("25-34") |
| ciudad | text | Ciudad del usuario |
| nivel_conocimiento | text | Nivel: principiante, intermedio, experto |
| objetivo_podcast | text | Objetivo: informarme, aprender, entretenerme |
| horario_escucha | text | Horario: manana, mediodia, tarde, noche |
| survey_completed | boolean | Flag de encuesta completada (default false) |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Fecha de ultima actualizacion |

- **Trigger**: Se crea automaticamente al registrarse (`handle_new_user`)
- **RLS**: Cada usuario solo ve y edita su propio perfil
- **Encuesta**: Los campos edad→horario_escucha se rellenan en el onboarding (paso 1). `survey_completed` permite al auth callback decidir a que paso redirigir.

#### 3.2 `preferences` — Preferencias del podcast

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID (PK) | ID autogenerado |
| user_id | UUID (FK, UNIQUE) | Referencia a `auth.users`, CASCADE |
| topics | text[] | Array de IDs de temas seleccionados |
| duration | integer | Duracion en minutos (5, 15, 30) |
| tone | text | Tono (casual, profesional, deep-dive) |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Fecha de ultima actualizacion |

- **RLS**: Cada usuario solo ve, crea y edita sus propias preferencias
- Incluye campo `voice` (text, default 'female') para persistir la preferencia de voz

#### 3.3 `episodes` — Episodios generados

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID (PK) | ID autogenerado |
| user_id | UUID (FK) | Referencia a `auth.users`, CASCADE |
| title | text | Titulo del episodio ("Podcast del 19/2/2026") |
| script | text | Guion completo en Markdown |
| audio_url | text | URL del MP3 en Supabase Storage |
| duration | integer | Duracion en minutos |
| tone | text | Tono usado |
| topics | text[] | Temas usados |
| articles | jsonb | Noticias fuente (JSON array) |
| adjustments | text | Ajustes pedidos por el usuario |
| created_at | timestamptz | Fecha de creacion |

- **Indice**: `episodes_user_date_idx` en (user_id, created_at DESC)
- **RLS**: Cada usuario solo ve, crea y edita sus propios episodios

#### 3.4 `raw_news` — Noticias sin procesar (News Agent)

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID (PK) | ID autogenerado |
| source_id | text | ID de la fuente (ej: `bbc-technology`) |
| source_name | text | Nombre de la fuente (ej: `BBC Technology`) |
| source_type | text | `rss` o `newsapi` |
| title | text | Titular de la noticia |
| description | text | Descripcion/extracto |
| content | text | Contenido completo (si disponible) |
| url | text (UNIQUE) | URL de la noticia (evita duplicados) |
| image_url | text | URL de la imagen |
| author | text | Autor |
| language | text | Idioma (`es`, `en`) |
| category | text | Categoria de la fuente |
| published_at | timestamptz | Fecha de publicacion |
| fetched_at | timestamptz | Fecha de recopilacion |
| processed | boolean | Flag de procesado (default false) |
| created_at | timestamptz | Fecha de creacion |

- **Upsert** por URL para evitar duplicados
- Se llena con `npm run agent:fetch`

#### 3.5 `processed_news` — Noticias clasificadas por IA (News Agent)

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID (PK) | ID autogenerado |
| raw_news_id | UUID (FK) | Referencia a `raw_news` |
| title | text | Titular original |
| summary | text | Resumen en espanol (2-3 frases, generado por Claude) |
| category | text | Categoria asignada por IA (technology, science, business, health, entertainment, sports, politics, general) |
| relevance_score | integer | Puntuacion de relevancia 1-10 (asignada por Claude) |
| language | text | Idioma detectado |
| keywords | text[] | 3-5 keywords extraidas por IA |
| url | text | URL de la noticia |
| source_name | text | Nombre de la fuente |
| published_at | timestamptz | Fecha de publicacion |
| processed_at | timestamptz | Fecha de procesamiento |
| created_at | timestamptz | Fecha de creacion |

- Se llena con `npm run agent:process`
- Consultada por `fetchFromAgent()` para generar podcasts
- Ordenada por `relevance_score DESC` al consultar

#### 3.6 `sources_health` — Estado de salud de fuentes (News Agent)

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID (PK) | ID autogenerado |
| source_id | text (UNIQUE) | ID de la fuente |
| source_name | text | Nombre de la fuente |
| source_type | text | Tipo de fuente |
| last_fetch_at | timestamptz | Ultimo intento de fetch |
| last_success_at | timestamptz | Ultimo fetch exitoso |
| last_error | text | Ultimo error |
| consecutive_failures | integer | Fallos consecutivos |
| total_articles_fetched | integer | Total de articulos recopilados |
| is_active | boolean | Si la fuente esta activa |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Ultima actualizacion |

- **RPCs**: `increment_articles_fetched(p_source_id, p_count)`, `increment_consecutive_failures(p_source_id)`

#### 3.7 Storage: Bucket `podcast-audio`

| Campo | Valor |
|-------|-------|
| Nombre | `podcast-audio` |
| Publico | Si (lectura publica) |
| Estructura | `{user_id}/{episode_id}.mp3` |
| Politica de subida | Solo usuarios autenticados a su propia carpeta |

### Seeds
No hay datos de seed. Las tablas se llenan desde la aplicacion.

---

## 4. Despliegue e infraestructura

### 4.1 Donde esta desplegado

| Componente | Plataforma | Detalle |
|-----------|-----------|---------|
| Frontend + API | **Vercel** | Proyecto `podcast-ai`, deploy automatico |
| Base de datos | **Supabase** | PostgreSQL managed (URL en env) |
| Almacenamiento audio | **Supabase Storage** | Bucket publico `podcast-audio` |

### 4.2 URLs y dominios

- **Vercel**: https://podcast-ai-sigma.vercel.app (dominio automatico de Vercel, no hay dominio custom)
- **Supabase**: `https://dwvyqoooirmetsalgicw.supabase.co` (segun .env.local)

### 4.3 CI/CD

- **GitHub repo**: https://github.com/angideosuna/podcast-ai.git (rama `master`)
- **Vercel**: Deploy manual con `npx vercel --prod` (el auto-deploy por push no esta activo)
- **No hay**: Pipelines custom, GitHub Actions, Docker, ni scripts de deploy dedicados

### 4.4 Scripts disponibles

```bash
# App
npm run dev             # Servidor de desarrollo (con --webpack)
npm run build           # Build de produccion
npm run start           # Servidor de produccion
npm run lint            # ESLint

# News Agent
npm run agent:fetch     # Recopila noticias de todas las fuentes → raw_news
npm run agent:process   # Procesa batch de 20 noticias raw → processed_news (clasificacion con Claude)
npm run agent:top       # Muestra top 10 noticias mas relevantes del dia
```

---

## 5. Flujo completo paso a paso

### Flujo A: Nuevo usuario (primera vez)

```
1. Usuario abre la app
   └→ GET / → redirect a /onboarding

2. Onboarding - Paso 1: Encuesta personal ("Cuentanos sobre ti")
   └→ Inputs: nombre*, edad, ciudad, rol, sector
   └→ Pickers: nivel_conocimiento* (principiante/intermedio/experto)
   └→           objetivo_podcast* (informarme/aprender/entretenerme)
   └→           horario_escucha* (manana/mediodia/tarde/noche)
   └→ (* = obligatorio)
   └→ POST /api/profile con survey_completed=true
   └→ Pre-popula datos si el usuario ya tiene perfil

3. Onboarding - Paso 2: Elegir temas
   └→ Selecciona 3-5 temas de los 8 disponibles
   └→ (tecnologia, IA, ciencia, politica, economia, startups, salud, cultura)

4. Onboarding - Paso 3: Configurar podcast
   └→ Elige duracion: 5 min (Express), 15 min (Estandar), 30 min (Deep Dive)
   └→ Elige tono: Casual, Profesional, Deep-dive
   └→ Elige voz: Femenina o Masculina
   └→ Click "Generar mi primer podcast"

5. Guardar preferencias
   └→ Se guardan en localStorage (siempre)
   └→ Se envian a POST /api/preferences (si esta logueado, no bloquea si falla)
   └→ Redirect a /onboarding/confirmacion

6. Confirmacion
   └→ Muestra resumen del perfil (nombre, nivel, objetivo, rol)
   └→ Muestra resumen de preferencias (temas, duracion, tono, voz)
   └→ Click "Generar mi primer podcast"
   └→ Redirect a /podcast

7. Generacion del podcast (pagina /podcast)
   └→ Proteccion doble-click: AbortController cancela peticion anterior + boton deshabilitado
   └→ Fase 1 "Buscando noticias..." (800ms UI delay)
   └→ POST /api/generate-podcast con {topics, duration, tone}
      ├→ Validacion de inputs:
      │    └→ topics: array de IDs validos (deben existir en TOPICS)
      │    └→ duration: solo 5, 15 o 30
      │    └→ tone: solo "casual", "profesional" o "deep-dive"
      │    └→ adjustments: max 500 caracteres (opcional)
      ├→ fetchFromAgent(topics, minArticles+2)       ← PRIMERO: consulta processed_news
      │    └→ Mapea topics → categorias del agente
      │    └→ SELECT * FROM processed_news WHERE category IN (...) ORDER BY relevance_score DESC
      │    └→ Convierte ProcessedNewsItem → Article[]
      ├→ Si no hay suficientes articulos del agente:
      │    └→ fetchNews(topics)                       ← FALLBACK: GNews API
      │         └→ GET gnews.io/api/v4/search?q=...&lang=es&max=10
      ├→ Fetch perfil del usuario (nombre, nivel, objetivo, horario...) — con log.warn si falla
      ├→ Usa un unico cliente Supabase para perfil y guardado de episodio
      ├→ generateScript(articles, duration, tone, adjustments, profile)
      │    └→ Construye prompt con noticias + formato + estilo
      │    └→ Inyecta bloque "PERFIL DEL OYENTE" si hay perfil
      │    └→ POST a Claude API (claude-sonnet-4)
      │    └→ Devuelve guion en Markdown personalizado al perfil
      └→ Guarda episodio en Supabase (si autenticado)
   └→ Fase 2 "Generando guion..."
   └→ Fase 3 "Listo!"

8. Mostrar resultado
   └→ Guion renderizado (Markdown → HTML)
   └→ Lista de fuentes/articulos usados
   └→ BrowserAudioPlayer en la parte inferior
   └→ Botones: Regenerar, Ajustar, Cambiar preferencias

9. Escuchar el podcast
   └→ Opcion A (Web Speech API): Click Play → Navegador lee el guion en voz alta
   └→ Opcion B (ElevenLabs): POST /api/generate-audio → Genera MP3 → AudioPlayer
```

### Flujo B: Usuario recurrente (ya tiene cuenta)

```
1. Login → /login
   └→ Email + password → Supabase Auth
   └→ Auth callback con routing de 3 vias:
      ├→ Tiene preferences → /dashboard
      ├→ Tiene survey_completed pero no preferences → /onboarding?step=2
      └→ No tiene survey → /onboarding

2. Dashboard
   └→ Saludo contextual (Buenos dias/tardes/noches, Nombre)
   └→ Si hay episodio de hoy: boton "Escuchar"
   └→ Si no: boton "Generar podcast de hoy"
   └→ Ultimos 3 episodios
   └→ Stats: total episodios, minutos generados

3. Generar podcast → /podcast (mismo flujo que arriba)

4. Historial → /historial
   └→ Lista de todos los episodios ordenados por fecha
   └→ Click en episodio → /historial/{id}
      └→ Guion completo
      └→ Fuentes
      └→ AudioPlayer (genera audio si no existe)

5. Ajustar episodio (desde /podcast)
   └→ Abre dialog con sugerencias rapidas
   └→ Escribe ajustes libres ("mas sobre IA", "menos politica")
   └→ Regenera el podcast con los ajustes como parametro adicional a Claude
```

### Flujo C: Middleware (en cada request)

```
1. Cada peticion HTTP pasa por middleware.ts
   └→ Refresca token de sesion de Supabase
   └→ Si ruta protegida (/dashboard, /historial, /perfil) y no logueado:
      └→ Redirect a /login?redirect=/ruta-original
   └→ Si logueado y va a /login o /signup:
      └→ Redirect a /dashboard
```

---

## 6. Estado actual

### 6.1 Que funciona

| Feature | Estado | Notas |
|---------|--------|-------|
| Onboarding completo | OK | 3 pasos: encuesta personal + temas + config |
| Encuesta personal | OK | Paso 1 del onboarding: nombre, edad, ciudad, nivel, objetivo, horario |
| Personalizacion por perfil | OK | Bloque "PERFIL DEL OYENTE" inyectado en prompt de Claude |
| News Agent (fuente principal) | OK | 9 fuentes (8 RSS + NewsAPI), clasificacion con Claude, ~500 noticias/fetch |
| Busqueda de noticias (fallback) | OK | GNews API, 100 req/dia gratis, se usa solo si el agente no tiene suficientes |
| Generacion de guion con Claude | OK | claude-sonnet-4, system prompt con personalidad + prompts v2 con variabilidad |
| Reproduccion con Web Speech API | OK | Fallback gratuito, voces es-ES |
| Generacion de audio ElevenLabs | OK | Requiere API key |
| Auth (registro, login, logout) | OK | Supabase Auth con email |
| Confirmacion de email | OK | Callback en /auth/callback con routing de 3 vias |
| Middleware de rutas protegidas | OK | proxy.ts (Middleware/Proxy de Next.js) |
| Dashboard con episodio del dia | OK | Saludo contextual, stats |
| Historial de episodios | OK | Lista + detalle |
| Detalle de episodio con audio | OK | Genera audio bajo demanda |
| Perfil de usuario editable | OK | Nombre, empresa, rol, sector, edad, ciudad + dropdowns nivel/objetivo/horario |
| Ajustar episodio del dia | OK | Sugerencias rapidas + texto libre |
| Guardar en Supabase | OK | Episodios, preferencias, perfiles |
| Upload audio a Storage | OK | MP3 en bucket publico |
| Tipos centralizados | OK | lib/types.ts |
| Logger profesional | OK | lib/logger.ts con contexto |
| Build de produccion | OK | Pasa tsc + eslint + next build |
| Validacion de inputs en API | OK | topics (IDs validos), duration (5/15/30), tone (3 valores), adjustments (max 500 chars) |
| Proteccion doble-click | OK | AbortController cancela peticion anterior + botones deshabilitados durante generacion |
| Markdown tema claro | OK | Colores text-stone-* coherentes con fondo bg-stone-100 de la app |
| JSON.parse seguro en localStorage | OK | try-catch con fallback en podcast y confirmacion |
| Response.ok antes de JSON parse | OK | Evita crash si el servidor devuelve error no-JSON |
| Batch insert en News Agent | OK | saveRawNews usa upsert en batch (1 query en vez de N+1) |
| Retry en clasificador | OK | 1 reintento con 3s de backoff si un batch de Claude falla |
| JSON parsing robusto en clasificador | OK | Maneja objetos sueltos, trailing commas, valida campos con defaults |
| Emoji removal universal | OK | Regex Unicode (\p{Emoji_Presentation}\|\p{Extended_Pictographic}) en tts-utils |
| Utilidad getTopicById | OK | TOPICS_MAP + getTopicById() en lib/topics.ts, usado en 5+ archivos |
| Sanitizacion de newlines en prompt | OK | Titulo y descripcion de articulos limpiados antes de interpolar |
| Constante ARTICLES_BY_DURATION compartida | OK | Exportada desde generate-script.ts, importada en route.ts |
| Cliente Supabase reutilizado en route | OK | Un solo createClient() para perfil + guardado de episodio |
| Log warning en profile catch | OK | log.warn en vez de catch silencioso al cargar perfil |

### 6.2 Bugs conocidos

| Bug | Severidad | Detalle |
|-----|-----------|---------|
| Concatenacion de MP3 cruda | **Baja** | Cuando el guion es largo y se divide en chunks, los buffers MP3 se concatenan byte a byte. Esto puede causar glitches de audio en los cortes entre fragmentos. Lo correcto seria usar un muxer MP3. |

**Bugs corregidos en v5:**
- ~~Markdown renderer usaba colores de tema oscuro (text-slate-200) sobre fondo claro~~ → Corregido a text-stone-*
- ~~response.json() antes de verificar response.ok~~ → Ahora verifica primero, parsea con .catch()
- ~~JSON.parse sin try-catch en localStorage~~ → Wrapeado en try-catch con fallback null
- ~~Validacion insuficiente en API (topics/duration/tone)~~ → Validacion estricta de tipos y valores
- ~~Doble-click lanza 2 peticiones simultaneas~~ → AbortController + isGenerating flag
- ~~2 clientes Supabase en la misma ruta~~ → 1 solo cliente reutilizado
- ~~N+1 inserts en saveRawNews~~ → Batch upsert (1 query)
- ~~Batch perdido si Claude falla en clasificador~~ → 1 reintento con 3s backoff
- ~~JSON no-array o trailing comma rompe batch entero~~ → Parsing robusto con fallbacks
- ~~Lista hardcodeada de 17 emojis en TTS~~ → Regex Unicode universal
- ~~TOPICS.find() repetido en 5+ archivos~~ → getTopicById() centralizado
- ~~Newlines en articulos pueden romper prompt~~ → Sanitizacion antes de interpolar
- ~~Catch silencioso en profile fetch~~ → log.warn con detalle del error

### 6.3 Cosas pendientes / mejorables

| Pendiente | Prioridad | Detalle |
|-----------|-----------|---------|
| Cache de noticias | ~~Media~~ Resuelto | El News Agent actua como cache: las noticias se recopilan y procesan por adelantado en processed_news. GNews solo se usa como fallback. |
| Automatizar agent:fetch/process | Media | Actualmente se ejecutan manualmente. Podria automatizarse con cron o scheduler. |
| Paginacion en historial | Baja | Carga todos los episodios de golpe. Con muchos episodios sera lento. |
| Tests unitarios | Media | No hay ni un test. Al menos testear newsapi.ts, generate-script.ts y elevenlabs.ts. |
| Dominio custom | Baja | Solo tiene el dominio automatico de Vercel. |
| Analytics / Metricas | Baja | No hay tracking de uso, errores ni engagement. |
| Validacion de tamano de audio | Baja | No hay limite de tamano antes de subir a Supabase Storage. |
| Filtros en historial | Baja | No se puede filtrar por tema, tono o fecha. |
| Soporte offline / PWA | Baja | No hay Service Worker ni manifiesto PWA. |

### 6.4 Variables de entorno (todas configuradas)

Todas las variables estan configuradas en `.env.local`. Para referencia:

| Variable | Obligatoria | Estado |
|----------|-------------|--------|
| `GNEWS_API_KEY` | No* | Configurada |
| `ANTHROPIC_API_KEY` | Si | Configurada |
| `ELEVENLABS_API_KEY` | No** | Configurada |
| `NEWSAPI_KEY` | No*** | Configurada |
| `NEXT_PUBLIC_SUPABASE_URL` | Si | Configurada |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | Configurada |
| `SUPABASE_SERVICE_ROLE_KEY` | Si | Configurada (usada por el News Agent) |

(*) Solo necesaria como fallback si el News Agent no tiene suficientes articulos
(**) Sin ElevenLabs funciona igual usando Web Speech API del navegador
(***) Usada por el News Agent para recopilar noticias de NewsAPI.org

### 6.5 Estructura de archivos actual

```
podcast-ai/
├── app/
│   ├── (authenticated)/          # Route group: rutas con NavHeader
│   │   ├── dashboard/page.tsx    # Dashboard principal
│   │   └── historial/
│   │       ├── page.tsx          # Lista de episodios
│   │       └── [id]/page.tsx     # Detalle de episodio
│   ├── api/
│   │   ├── generate-podcast/route.ts   # POST: noticias + guion + guardar
│   │   ├── generate-audio/route.ts     # POST: TTS con ElevenLabs
│   │   ├── preferences/route.ts        # GET/POST preferencias
│   │   └── profile/route.ts            # GET/POST perfil
│   ├── auth/callback/route.ts    # Callback de Supabase Auth
│   ├── login/page.tsx            # Login
│   ├── signup/page.tsx           # Registro
│   ├── onboarding/
│   │   ├── page.tsx              # Onboarding 3 pasos: encuesta + temas + config
│   │   └── confirmacion/page.tsx # Confirmacion con resumen perfil + preferencias
│   ├── perfil/page.tsx           # Editar perfil (datos personales + preferencias podcast)
│   ├── podcast/page.tsx          # Generacion y vista del podcast
│   ├── layout.tsx                # Root layout (fuentes, metadata, dark mode)
│   ├── globals.css               # Estilos globales + shadcn variables
│   ├── error.tsx                 # Error boundary global
│   ├── not-found.tsx             # Pagina 404
│   ├── page.tsx                  # Home → redirect /onboarding
│   └── favicon.ico
├── components/
│   ├── ui/                       # shadcn/ui (avatar, badge, button, card, dialog, dropdown, separator, skeleton)
│   ├── audio-player.tsx          # Reproductor para ElevenLabs (con seek, velocidad)
│   ├── browser-audio-player.tsx  # Reproductor Web Speech API (play/pause/stop)
│   ├── adjust-episode.tsx        # Dialog para ajustar episodio
│   ├── duration-picker.tsx       # Selector de duracion (5/15/30)
│   ├── tone-picker.tsx           # Selector de tono
│   ├── voice-picker.tsx          # Selector de voz (M/F)
│   ├── option-picker.tsx         # Picker generico reutilizable (nivel, objetivo, horario)
│   ├── topic-card.tsx            # Tarjeta de tema seleccionable
│   └── nav-header.tsx            # Navegacion principal (desktop + mobile)
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Cliente Supabase para el navegador
│   │   └── server.ts             # Cliente Supabase para el servidor
│   ├── types.ts                  # Tipos TypeScript centralizados + label constants
│   ├── logger.ts                 # Logger profesional con contexto
│   ├── newsapi.ts                # Servicio GNews
│   ├── generate-script.ts        # Generacion de guiones con Claude + personalizacion por perfil
│   ├── elevenlabs.ts             # TTS con ElevenLabs
│   ├── tts-utils.ts              # Limpieza de guion para TTS (regex Unicode para todos los emojis)
│   ├── markdown.ts               # Renderizado Markdown → HTML (tema claro: text-stone-*)
│   ├── auth-utils.ts             # Utilidades de auth (logout)
│   ├── topics.ts                 # Datos de temas (8 temas + config + getTopicById + TOPICS_MAP)
│   └── utils.ts                  # Utilidad cn() para clases CSS
├── src/
│   └── agents/
│       └── news-agent/
│           ├── index.ts              # Clase NewsAgent (fetchAll, processAll, getTopNews)
│           ├── config/
│           │   ├── agent-config.json # Intervalos, batch size, categorias
│           │   └── sources.json      # Feeds RSS y APIs habilitadas
│           ├── sources/
│           │   ├── index.ts          # Agrega todos los fetchers
│           │   ├── rss.ts            # Parser RSS/Atom generico
│           │   └── newsapi.ts        # Integracion NewsAPI.org
│           ├── processors/
│           │   ├── index.ts          # Pipeline: dedup → clasificar → guardar
│           │   ├── classifier.ts     # Clasificacion con Claude Sonnet 4
│           │   └── deduplicator.ts   # Dedup por similitud de titulo (>70%)
│           ├── storage/
│           │   ├── supabase.ts       # CRUD Supabase (raw_news, processed_news, sources_health)
│           │   └── get-articles.ts   # fetchFromAgent() — bridge agente → podcast
│           ├── scripts/
│           │   ├── fetch.ts          # CLI: npm run agent:fetch
│           │   ├── process.ts        # CLI: npm run agent:process
│           │   └── top.ts            # CLI: npm run agent:top
│           └── utils/
│               ├── types.ts          # Tipos del agente (RawNewsItem, ProcessedNewsItem, etc.)
│               └── env.ts            # Carga de variables de entorno
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql  # Schema completo (3 tablas + storage + RLS)
│       ├── 002_add_voice_to_preferences.sql  # Campo voice en preferences
│       └── 003_add_survey_fields.sql  # Campos encuesta personal en profiles
├── episodios/
│   └── 2026-02-18-briefing.md    # Episodio de ejemplo generado
├── public/                       # SVGs estaticos (file, globe, next, vercel, window)
├── .claude/                      # Configuracion de Claude Code (CLAUDE.md, skills, commands)
├── proxy.ts                     # Middleware/Proxy Next.js (auth + sesion)
├── next.config.ts                # Config Next.js (imagenes Supabase)
├── tsconfig.json                 # TypeScript strict mode + path aliases
├── eslint.config.mjs             # ESLint + Next.js rules
├── postcss.config.mjs            # PostCSS + Tailwind v4
├── components.json               # shadcn/ui config (new-york style)
├── package.json                  # Dependencias y scripts
├── package-lock.json
├── .env.example                  # Plantilla de variables de entorno
├── .env.local                    # Variables reales (NO commitear)
├── .gitignore                    # Ignora .env*, .next, node_modules, episodios, output
└── README.md                     # Documentacion del proyecto
```

---

## Apendice: Credenciales necesarias

Todas las cuentas estan creadas y configuradas en `.env.local`:

| Servicio | Estado | Plan | Donde obtenerla |
|----------|--------|------|-----------------|
| **GNews** | Configurado | Gratis (100 req/dia) | https://gnews.io |
| **NewsAPI.org** | Configurado | Gratis (100 req/dia) | https://newsapi.org |
| **Anthropic** | Configurado | De pago | https://console.anthropic.com |
| **ElevenLabs** | Configurado | De pago | https://elevenlabs.io |
| **Supabase** | Configurado | Gratis | https://supabase.com |
| **Vercel** | Configurado | Gratis | https://vercel.com |

Si alguien clona el proyecto: copiar `.env.example` a `.env.local`, rellenar los valores, y ejecutar la migration SQL en el editor de Supabase.
