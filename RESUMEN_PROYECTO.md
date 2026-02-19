# RESUMEN COMPLETO DEL PROYECTO — PodCast.ai

> Ultima actualizacion: 19 de febrero de 2026

---

## 1. Resumen general

### Que hace la app

**PodCast.ai** es una aplicacion web que genera podcasts diarios personalizados con voces AI. El usuario elige sus temas de interes, duracion, tono y voz preferida. La app busca noticias reales del dia, genera un guion conversacional con IA, y lo convierte en audio con voz natural.

### Flujo resumido

```
Usuario configura preferencias → App busca noticias del dia → Claude genera guion → ElevenLabs genera audio → Usuario escucha su podcast
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
| Noticias | GNews API | v4 |
| IA / Guiones | Claude API (Anthropic SDK) | SDK 0.76.0, modelo `claude-sonnet-4-20250514` |
| Audio / TTS | ElevenLabs API | Modelo `eleven_multilingual_v2` |
| Audio / Fallback | Web Speech API (nativa del navegador) | Sin dependencia |
| Deploy | Vercel | Proyecto `podcast-ai` |
| Iconos | Lucide React | 0.574.0 |
| UI Components | Radix UI (via shadcn) | 1.4.3 |

---

## 2. Servicios externos y APIs

### 2.1 GNews API — Noticias del dia

| Campo | Valor |
|-------|-------|
| Para que se usa | Buscar noticias reales del dia sobre los temas del usuario |
| Endpoint | `https://gnews.io/api/v4/search` |
| Archivo | `lib/newsapi.ts` |
| Variable de entorno | `GNEWS_API_KEY` |
| Plan actual | Gratis (100 peticiones/dia, max 10 resultados por query) |
| Idioma de busqueda | Espanol (`lang=es`) |

**Mapeo de temas a busquedas:**

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

### 2.2 Claude API (Anthropic) — Generacion de guiones

| Campo | Valor |
|-------|-------|
| Para que se usa | Generar el guion conversacional del podcast a partir de las noticias |
| Libreria | `@anthropic-ai/sdk` v0.76.0 |
| Modelo | `claude-sonnet-4-20250514` |
| Max tokens | 4096 |
| Archivo | `lib/generate-script.ts` |
| Variable de entorno | `ANTHROPIC_API_KEY` |

**Como funciona:**
1. Recibe las noticias filtradas por GNews
2. Construye un prompt detallado con: noticias, formato de guion, estilo segun tono, reglas de idioma
3. Claude genera un guion en Markdown con estructura: INTRO → NOTICIAS → CIERRE
4. Calcula tiempos por seccion segun duracion (150 palabras = 1 minuto de audio)

**Configuracion de tiempos:**

| Duracion | Noticias | Intro | Cierre | Segundos/noticia |
|----------|----------|-------|--------|-----------------|
| 5 min | 3 | 30s | 30s | ~80s |
| 15 min | 5 | 45s | 45s | ~150s |
| 30 min | 8 | 60s | 60s | ~195s |

**Tonos soportados:**
- `casual`: Como un amigo que sabe mucho, coloquial, tutea
- `profesional`: Briefing ejecutivo, datos concretos, formal pero accesible
- `deep-dive`: Analitico, contexto historico, datos y cifras, reflexion profunda

### 2.3 ElevenLabs — Text-to-Speech

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

### 2.4 Web Speech API — Fallback gratuito de TTS

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

### 2.5 Supabase — Base de datos, Auth y Storage

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

### 2.6 Vercel — Hosting y deploy

| Campo | Valor |
|-------|-------|
| Para que se usa | Hosting de la aplicacion Next.js |
| Project ID | `prj_YgUD18SkMpKPe4xkOxmqAs47uAlK` |
| Org ID | `team_UnanlHXGfKm6eBPAdJNfbCMr` |
| Nombre del proyecto | `podcast-ai` |
| Archivo config | `.vercel/project.json` |
| Limite API routes | 60 segundos (`maxDuration` en generate-audio) |

### 2.7 Servicios configurados pero NO usados activamente

| Servicio | Estado |
|----------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` | Declarado en `.env.example` pero no se usa en el codigo. Todas las operaciones usan el anon key con RLS. |
| `ELEVENLABS_VOICE_ID` (env var) | Declarado pero el codigo prioriza las voces segun preferencia del usuario. Solo se usa si esta configurado Y el usuario no elige voz. |

---

## 3. Base de datos

### Plataforma
PostgreSQL alojado en **Supabase** (plan gratis).

### Migration
Archivo: `supabase/migrations/001_initial_schema.sql`

### Tablas

#### 3.1 `profiles` — Datos del usuario

| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | UUID (PK) | Referencia a `auth.users`, CASCADE |
| nombre | text | Nombre del usuario |
| empresa | text | Empresa donde trabaja |
| rol | text | Rol profesional (CEO, CTO, etc.) |
| sector | text | Sector (Tech, Finanzas, Salud, etc.) |
| created_at | timestamptz | Fecha de creacion |
| updated_at | timestamptz | Fecha de ultima actualizacion |

- **Trigger**: Se crea automaticamente al registrarse (`handle_new_user`)
- **RLS**: Cada usuario solo ve y edita su propio perfil

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
- **BUG CONOCIDO**: No tiene campo `voice`. El frontend envia y usa `voice` pero no se persiste en Supabase (solo en localStorage)

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

#### 3.4 Storage: Bucket `podcast-audio`

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

- **Vercel**: Dominio automatico de Vercel (no hay dominio custom configurado en el codigo)
- **Supabase**: `https://dwvyqoooirmetsalgicw.supabase.co` (segun .env.local)

### 4.3 CI/CD

- **Vercel Git Integration**: Probablemente conectado al repo de Git. Cada push a `master` dispara un deploy automatico.
- **No hay**: Pipelines custom, GitHub Actions, Docker, ni scripts de deploy dedicados

### 4.4 Scripts disponibles

```bash
npm run dev      # Servidor de desarrollo (con --webpack)
npm run build    # Build de produccion
npm run start    # Servidor de produccion
npm run lint     # ESLint
```

---

## 5. Flujo completo paso a paso

### Flujo A: Nuevo usuario (primera vez)

```
1. Usuario abre la app
   └→ GET / → redirect a /onboarding

2. Onboarding - Paso 1: Elegir temas
   └→ Selecciona 3-5 temas de los 8 disponibles
   └→ (tecnologia, IA, ciencia, politica, economia, startups, salud, cultura)

3. Onboarding - Paso 2: Configurar podcast
   └→ Elige duracion: 5 min (Express), 15 min (Estandar), 30 min (Deep Dive)
   └→ Elige tono: Casual, Profesional, Deep-dive
   └→ Elige voz: Femenina o Masculina
   └→ Click "Generar mi primer podcast"

4. Guardar preferencias
   └→ Se guardan en localStorage (siempre)
   └→ Se envian a POST /api/preferences (si esta logueado, no bloquea si falla)
   └→ Redirect a /onboarding/confirmacion

5. Confirmacion
   └→ Muestra resumen de preferencias
   └→ Click "Generar mi primer podcast"
   └→ Redirect a /podcast

6. Generacion del podcast (pagina /podcast)
   └→ Fase 1 "Buscando noticias..." (800ms UI delay)
   └→ POST /api/generate-podcast con {topics, duration, tone}
      ├→ fetchNews(topics)
      │    └→ GET gnews.io/api/v4/search?q=...&lang=es&max=10
      │    └→ Devuelve array de Article[]
      ├→ generateScript(articles, duration, tone)
      │    └→ Construye prompt con noticias + formato + estilo
      │    └→ POST a Claude API (claude-sonnet-4)
      │    └→ Devuelve guion en Markdown
      └→ Guarda episodio en Supabase (si autenticado)
   └→ Fase 2 "Generando guion..."
   └→ Fase 3 "Listo!"

7. Mostrar resultado
   └→ Guion renderizado (Markdown → HTML)
   └→ Lista de fuentes/articulos usados
   └→ BrowserAudioPlayer en la parte inferior
   └→ Botones: Regenerar, Ajustar, Cambiar preferencias

8. Escuchar el podcast
   └→ Opcion A (Web Speech API): Click Play → Navegador lee el guion en voz alta
   └→ Opcion B (ElevenLabs): POST /api/generate-audio → Genera MP3 → AudioPlayer
```

### Flujo B: Usuario recurrente (ya tiene cuenta)

```
1. Login → /login
   └→ Email + password → Supabase Auth
   └→ Redirect a /dashboard

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
| Onboarding completo | OK | 2 pasos: temas + config |
| Busqueda de noticias | OK | GNews API, 100 req/dia gratis |
| Generacion de guion con Claude | OK | claude-sonnet-4, prompt detallado |
| Reproduccion con Web Speech API | OK | Fallback gratuito, voces es-ES |
| Generacion de audio ElevenLabs | OK | Requiere API key |
| Auth (registro, login, logout) | OK | Supabase Auth con email |
| Confirmacion de email | OK | Callback en /auth/callback |
| Middleware de rutas protegidas | OK | Renombrado de proxy.ts a middleware.ts |
| Dashboard con episodio del dia | OK | Saludo contextual, stats |
| Historial de episodios | OK | Lista + detalle |
| Detalle de episodio con audio | OK | Genera audio bajo demanda |
| Perfil de usuario editable | OK | Nombre, empresa, rol, sector |
| Ajustar episodio del dia | OK | Sugerencias rapidas + texto libre |
| Guardar en Supabase | OK | Episodios, preferencias, perfiles |
| Upload audio a Storage | OK | MP3 en bucket publico |
| Tipos centralizados | OK | lib/types.ts |
| Logger profesional | OK | lib/logger.ts con contexto |
| Build de produccion | OK | Pasa tsc + eslint + next build |

### 6.2 Bugs conocidos

| Bug | Severidad | Detalle |
|-----|-----------|---------|
| Campo `voice` no se persiste en Supabase | **Media** | La tabla `preferences` no tiene columna `voice`. El frontend lo envia en POST pero Supabase lo ignora. Solo se guarda en localStorage. Si el usuario borra cache o usa otro dispositivo, pierde la preferencia de voz. |
| Concatenacion de MP3 cruda | **Baja** | Cuando el guion es largo y se divide en chunks, los buffers MP3 se concatenan byte a byte. Esto puede causar glitches de audio en los cortes entre fragmentos. Lo correcto seria usar un muxer MP3. |

### 6.3 Cosas pendientes / mejorables

| Pendiente | Prioridad | Detalle |
|-----------|-----------|---------|
| Anadir `voice` a tabla `preferences` | Alta | Crear migration: `ALTER TABLE preferences ADD COLUMN voice text DEFAULT 'female'` |
| Cache de noticias | Media | GNews tiene limite de 100 req/dia. No hay cache. Deberia cachear por topic + fecha. |
| Paginacion en historial | Baja | Carga todos los episodios de golpe. Con muchos episodios sera lento. |
| Tests unitarios | Media | No hay ni un test. Al menos testear newsapi.ts, generate-script.ts y elevenlabs.ts. |
| Dominio custom | Baja | Solo tiene el dominio automatico de Vercel. |
| Analytics / Metricas | Baja | No hay tracking de uso, errores ni engagement. |
| Validacion de tamano de audio | Baja | No hay limite de tamano antes de subir a Supabase Storage. |
| Filtros en historial | Baja | No se puede filtrar por tema, tono o fecha. |
| Soporte offline / PWA | Baja | No hay Service Worker ni manifiesto PWA. |

### 6.4 Dependencias sin configurar (segun .env.example)

Si alguien clona el proyecto, necesita configurar:

| Variable | Obligatoria | Donde obtenerla |
|----------|-------------|-----------------|
| `GNEWS_API_KEY` | Si | https://gnews.io (gratis, registro) |
| `ANTHROPIC_API_KEY` | Si | https://console.anthropic.com (de pago) |
| `ELEVENLABS_API_KEY` | No* | https://elevenlabs.io (hay plan gratis limitado) |
| `NEXT_PUBLIC_SUPABASE_URL` | Si | Panel de Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Si | Panel de Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Si** | Panel de Supabase → Settings → API |

(*) Sin ElevenLabs funciona igual usando Web Speech API del navegador
(**) Declarado en .env.example pero no se usa activamente en el codigo

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
│   │   ├── page.tsx              # Configuracion de preferencias
│   │   └── confirmacion/page.tsx # Confirmacion
│   ├── perfil/page.tsx           # Editar perfil
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
│   ├── topic-card.tsx            # Tarjeta de tema seleccionable
│   └── nav-header.tsx            # Navegacion principal (desktop + mobile)
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Cliente Supabase para el navegador
│   │   └── server.ts             # Cliente Supabase para el servidor
│   ├── types.ts                  # Tipos TypeScript centralizados
│   ├── logger.ts                 # Logger profesional con contexto
│   ├── newsapi.ts                # Servicio GNews
│   ├── generate-script.ts        # Generacion de guiones con Claude
│   ├── elevenlabs.ts             # TTS con ElevenLabs
│   ├── tts-utils.ts              # Limpieza de guion para TTS
│   ├── markdown.ts               # Renderizado Markdown → HTML
│   ├── auth-utils.ts             # Utilidades de auth (logout)
│   ├── topics.ts                 # Datos de temas (8 temas + config)
│   └── utils.ts                  # Utilidad cn() para clases CSS
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  # Schema completo (3 tablas + storage + RLS)
├── episodios/
│   └── 2026-02-18-briefing.md    # Episodio de ejemplo generado
├── public/                       # SVGs estaticos (file, globe, next, vercel, window)
├── .claude/                      # Configuracion de Claude Code (CLAUDE.md, skills, commands)
├── middleware.ts                 # Middleware Next.js (auth + sesion)
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

Para tener el proyecto funcionando al 100%, necesitas cuentas en:

1. **GNews** (https://gnews.io) — API key gratis, 100 req/dia
2. **Anthropic** (https://console.anthropic.com) — API key de pago para Claude
3. **ElevenLabs** (https://elevenlabs.io) — API key opcional, hay plan gratis limitado
4. **Supabase** (https://supabase.com) — Proyecto gratis con PostgreSQL + Auth + Storage
5. **Vercel** (https://vercel.com) — Hosting gratis para Next.js

Copia `.env.example` a `.env.local` y rellena los valores. Ejecuta la migration SQL en el editor de Supabase.
