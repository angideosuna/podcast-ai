# Skill: Preparar Episodio

Prepara un episodio completo de PodCast.ai, desde la investigación hasta el archivo final listo para publicar.

## Cuándo se usa

Cuando el usuario quiere generar un nuevo episodio de podcast. Puede decir:
- "Prepara el episodio de hoy"
- "Genera un podcast sobre [tema específico]"
- "Prepárame el episodio de mañana"

## Inputs

| Parámetro | Tipo | Default | Descripción |
|-----------|------|---------|-------------|
| temas | lista | Los del perfil del usuario | Temas a cubrir (ej: "IA, startups, ciencia") |
| duración | número | 5 | Minutos: 5, 15 o 30 |
| tono | texto | casual | casual, profesional o deep-dive |
| fecha | texto | hoy | Fecha del episodio |

Si el usuario no especifica parámetros, usar los valores guardados en localStorage o los defaults.

## Proceso

### Paso 1: Configurar el episodio

1. Obtener la fecha: ejecutar `date +"%Y-%m-%d"` (o equivalente Windows)
2. Determinar temas, duración y tono (del input o defaults)
3. Calcular número de noticias según duración:
   - 5 min → 3 noticias
   - 15 min → 5 noticias
   - 30 min → 8 noticias

### Paso 2: Investigar noticias

Usar **WebSearch** para buscar noticias relevantes del día. Hacer al menos 3 búsquedas variadas:

- Búsqueda general por cada tema seleccionado
- Búsqueda en inglés para cobertura internacional
- Búsqueda específica de tendencias

Para cada noticia seleccionada, extraer:
- Titular
- Fuente original
- Resumen (2-3 frases)
- Por qué es relevante

**Criterios de selección:**
- Priorizar noticias del mismo día o día anterior
- Diversificar fuentes (no todas del mismo medio)
- Buscar el ángulo interesante, no solo el titular

### Paso 3: Generar el guion

Seguir el formato de referencia en `references/formato-guion.md`.

**Reglas de estilo:**
- Idioma: Español de España
- Transiciones naturales y conversacionales
- Explicar términos técnicos en una frase
- Incluir fuente entre paréntesis después de cada noticia
- Cerrar con una pregunta abierta para el oyente

### Paso 4: Guardar el episodio

1. Crear el archivo en: `episodios/[FECHA]-[TIPO].md`
   - Tipos: briefing (5 min), standard (15 min), deepdive (30 min)
2. Crear la carpeta `episodios/` si no existe

### Paso 5: Generar checklist de publicación

Mostrar al usuario:
```
✅ Episodio del [FECHA] preparado

📄 Archivo: episodios/[FECHA]-[TIPO].md
📰 Noticias cubiertas:
  1. [titular]
  2. [titular]
  ...

⏱️ Duración estimada: ~[X] minutos
🎯 Tono: [tono seleccionado]

📋 Checklist de publicación:
  [ ] Revisar el guion
  [ ] Ajustar si necesitas ("hazlo más corto", "cambia el tono")
  [ ] Generar audio (próximamente)
  [ ] Publicar
```

## Manejo de errores

- Si WebSearch no encuentra noticias recientes: usar noticias de los últimos 2-3 días
- Si un tema no tiene resultados: informar al usuario y sugerir temas alternativos
- Si hay problemas técnicos: mostrar error claro y sugerir reintentar
