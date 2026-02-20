// POST /api/suggest-topics — AI-powered topic suggestions based on user profile

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const CATEGORIES_DESC = `1. tecnologia — IA, Ciberseguridad, Startups, Gadgets, Programación
2. ciencia — Espacio, Naturaleza, Neurociencia, Medicina
3. negocios-finanzas — Emprendimiento, Marketing, Inversiones, Economía
4. entretenimiento — Cine y Series, Videojuegos, Música, Comedia
5. salud-bienestar — Fitness, Nutrición, Salud Mental, Desarrollo Personal
6. sociedad-cultura — Política y Actualidad, Historia, Filosofía, Educación
7. true-crime-misterio — Casos Reales, Paranormal, Conspiraciones, Criminología
8. lifestyle — Viajes, Gastronomía, Deportes, Relaciones y Familia`;

const VALID_IDS = new Set([
  "tecnologia", "ciencia", "negocios-finanzas", "entretenimiento",
  "salud-bienestar", "sociedad-cultura", "true-crime-misterio", "lifestyle",
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, rol, sector, objetivo } = body as {
      nombre?: string;
      rol?: string;
      sector?: string;
      objetivo?: string;
    };

    // Need at least one meaningful field
    if (!rol && !sector && !objetivo) {
      return NextResponse.json({ categories: [] });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ categories: [] });
    }

    const client = new Anthropic({ apiKey });

    const profileLines: string[] = [];
    if (nombre) profileLines.push(`- Nombre: ${nombre}`);
    if (rol) profileLines.push(`- Rol: ${rol}`);
    if (sector) profileLines.push(`- Sector: ${sector}`);
    if (objetivo) profileLines.push(`- Objetivo: ${objetivo}`);

    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Dado este perfil de usuario:
${profileLines.join("\n")}

De estas 8 categorías de podcast, sugiere las 3-4 más relevantes para este perfil.
Responde SOLO con un JSON array de IDs, sin explicación. Ejemplo: ["tecnologia", "negocios-finanzas"]

Categorías disponibles:
${CATEGORIES_DESC}`,
        },
      ],
    });

    const text = message.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") {
      return NextResponse.json({ categories: [] });
    }

    // Extract JSON array from response
    const match = text.text.match(/\[[\s\S]*\]/);
    if (!match) {
      return NextResponse.json({ categories: [] });
    }

    const parsed = JSON.parse(match[0]) as string[];
    const validated = parsed.filter((id) => VALID_IDS.has(id));

    return NextResponse.json({ categories: validated });
  } catch {
    return NextResponse.json({ categories: [] });
  }
}
