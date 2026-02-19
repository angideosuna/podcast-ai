# PodCast.ai

Genera podcasts diarios hiperpersonalizados con voces AI sobre los temas que te interesan.

## Features

- **Onboarding personalizado** — Elige 3-5 temas (tech, IA, ciencia, politica, economia, startups, salud, cultura), duracion (5/15/30 min), tono (casual/profesional/deep-dive) y voz
- **Noticias reales del dia** — Busca noticias actuales via GNews API
- **Guion generado con IA** — Claude (Anthropic) genera un guion conversacional en espanol
- **Audio con voz natural** — ElevenLabs TTS con voces en espanol + fallback gratuito con Web Speech API del navegador
- **Historial de episodios** — Guarda y reproduce episodios anteriores
- **Ajustes en tiempo real** — Modifica el tono, temas o enfoque del episodio del dia
- **Auth completa** — Registro, login, perfil de usuario con Supabase Auth

## Stack

| Capa | Tecnologia |
|------|-----------|
| Frontend | Next.js 16 + React 19 + Tailwind CSS 4 + shadcn/ui |
| Backend | Next.js API Routes |
| Base de datos | Supabase (PostgreSQL + Auth + Storage) |
| Noticias | GNews API |
| IA / Guiones | Claude API (Anthropic SDK) |
| Audio / TTS | ElevenLabs API + Web Speech API (fallback) |
| Deploy | Vercel |

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com) (gratis)
- API key de [GNews](https://gnews.io) (gratis, 100 req/dia)
- API key de [Anthropic](https://console.anthropic.com) (Claude)
- API key de [ElevenLabs](https://elevenlabs.io) (opcional, hay fallback gratuito)

## Instalacion

```bash
# 1. Clonar el repositorio
git clone <url-del-repo>
cd podcast-ai

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Edita .env.local con tus API keys

# 4. Configurar Supabase
# Ejecuta supabase/migrations/001_initial_schema.sql en tu proyecto de Supabase

# 5. Arrancar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Variables de entorno

Ver `.env.example` para la lista completa. Las obligatorias son:

| Variable | Descripcion |
|----------|-------------|
| `GNEWS_API_KEY` | API key de GNews para buscar noticias |
| `ANTHROPIC_API_KEY` | API key de Anthropic (Claude) para generar guiones |
| `NEXT_PUBLIC_SUPABASE_URL` | URL de tu proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave publica (anon) de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase (solo servidor) |
| `ELEVENLABS_API_KEY` | *(Opcional)* API key de ElevenLabs para TTS |
| `ELEVENLABS_VOICE_ID` | *(Opcional)* ID de voz personalizada de ElevenLabs |

## Estructura del proyecto

```
podcast-ai/
├── app/                          # Next.js App Router
│   ├── (authenticated)/          # Rutas protegidas (con NavHeader)
│   │   ├── dashboard/            # Dashboard principal
│   │   └── historial/            # Historial de episodios + detalle
│   ├── api/                      # API Routes
│   │   ├── generate-podcast/     # Orquesta noticias + guion + guardado
│   │   ├── generate-audio/       # TTS con ElevenLabs
│   │   ├── preferences/          # CRUD de preferencias
│   │   └── profile/              # CRUD de perfil
│   ├── auth/callback/            # Callback de Supabase Auth
│   ├── login/                    # Pagina de login
│   ├── signup/                   # Pagina de registro
│   ├── onboarding/               # Flujo de configuracion inicial
│   ├── perfil/                   # Pagina de perfil del usuario
│   ├── podcast/                  # Generacion y visualizacion del podcast
│   ├── layout.tsx                # Root layout (fuentes, metadata)
│   ├── error.tsx                 # Error boundary global
│   └── not-found.tsx             # Pagina 404
├── components/                   # Componentes React reutilizables
│   ├── ui/                       # Componentes base (shadcn/ui)
│   ├── audio-player.tsx          # Reproductor de audio (ElevenLabs)
│   ├── browser-audio-player.tsx  # Reproductor con Web Speech API
│   ├── adjust-episode.tsx        # Dialog para ajustar episodio
│   ├── duration-picker.tsx       # Selector de duracion
│   ├── tone-picker.tsx           # Selector de tono
│   ├── voice-picker.tsx          # Selector de voz
│   ├── topic-card.tsx            # Tarjeta de tema
│   └── nav-header.tsx            # Navegacion principal
├── lib/                          # Logica de negocio y utilidades
│   ├── supabase/                 # Clientes de Supabase (client/server)
│   ├── types.ts                  # Tipos TypeScript centralizados
│   ├── logger.ts                 # Logger profesional con contexto
│   ├── newsapi.ts                # Servicio de noticias (GNews)
│   ├── generate-script.ts        # Generacion de guiones (Claude)
│   ├── elevenlabs.ts             # Servicio de TTS (ElevenLabs)
│   ├── tts-utils.ts              # Utilidades compartidas de TTS
│   ├── markdown.ts               # Renderizado de Markdown a HTML
│   ├── auth-utils.ts             # Utilidades de autenticacion
│   ├── topics.ts                 # Datos de temas disponibles
│   └── utils.ts                  # Utilidades generales (cn)
├── supabase/migrations/          # SQL migrations
├── middleware.ts                  # Middleware de Next.js (auth + session)
├── .env.example                  # Plantilla de variables de entorno
└── package.json
```

## Scripts

```bash
npm run dev      # Servidor de desarrollo
npm run build    # Build de produccion
npm run start    # Servidor de produccion
npm run lint     # Linter (ESLint)
```

## Licencia

Proyecto privado.
