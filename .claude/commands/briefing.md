---
name: briefing
description: Genera el guion del podcast del día con las noticias más relevantes en tech y AI
---

# Comando: /briefing

Genera un episodio diario de PodCast.ai buscando noticias reales del día.

## Pasos

### 1. Obtener la fecha de hoy

Ejecuta `date +"%Y-%m-%d"` (o equivalente en Windows) para obtener la fecha actual. Usa esta fecha para nombrar el archivo de salida y para buscar noticias recientes.

### 2. Buscar noticias

Usa la herramienta **WebSearch** para buscar las 5 noticias más relevantes del día en tecnología e inteligencia artificial. Haz 2-3 búsquedas con términos variados:

- "noticias tecnología hoy [fecha]"
- "AI artificial intelligence news today"
- "startups tech novedades [fecha]"

De los resultados, selecciona las **5 noticias más interesantes y diversas** (no repetir tema). Para cada noticia, extrae:
- Titular
- Fuente
- Resumen de 2-3 frases

### 3. Generar el guion

Crea un guion de podcast de **~5 minutos** (aproximadamente 700-800 palabras) con este formato:

```
🎙️ PodCast.ai — Briefing del [FECHA]

[INTRO - 30 segundos]
Un saludo cercano y casual. Mencionar que hoy hay X noticias interesantes.
Dar un adelanto de la noticia más impactante para enganchar.

[NOTICIA 1 - 60 segundos]
Titular → Contexto → Por qué importa → Opinión breve

[NOTICIA 2 - 60 segundos]
Titular → Contexto → Por qué importa → Opinión breve

[NOTICIA 3 - 60 segundos]
Titular → Contexto → Por qué importa → Opinión breve

[NOTICIA 4 - 45 segundos]
Titular → Contexto → Por qué importa

[NOTICIA 5 - 45 segundos]
Titular → Contexto → Por qué importa

[CIERRE - 30 segundos]
Resumen de los temas del día.
Pregunta abierta para el oyente.
Despedida.
```

### Estilo del guion

- **Tono:** Casual pero informado. Como un amigo que sabe mucho de tech.
- **Idioma:** Español de España.
- **Transiciones:** Naturales, como si fuera una conversación ("Y mira, esto es lo bueno...", "Ahora viene lo fuerte...", "Cambiamos de tema...").
- **Sin jerga innecesaria.** Si hay un término técnico, explicarlo en una frase.
- **Incluir fuentes** entre paréntesis después de cada noticia.

### 4. Guardar el archivo

Guarda el guion en: `podcast-ai/episodios/[FECHA]-briefing.md`

Crea la carpeta `episodios/` si no existe.

### 5. Confirmar al usuario

Mostrar:
```
✅ Briefing del [FECHA] generado

📄 Archivo: episodios/[FECHA]-briefing.md
📰 Noticias cubiertas:
  1. [titular 1]
  2. [titular 2]
  3. [titular 3]
  4. [titular 4]
  5. [titular 5]

⏱️ Duración estimada: ~5 minutos
🎯 Para ajustar: "hazlo más largo/corto" o "añade noticias de [tema]"
```
