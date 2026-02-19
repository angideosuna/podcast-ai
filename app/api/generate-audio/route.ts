// API Route: Genera audio del podcast usando ElevenLabs
// POST /api/generate-audio

import { NextResponse } from "next/server";
import { generateAudio } from "@/lib/elevenlabs";
import { createClient } from "@/lib/supabase/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/generate-audio");

export const maxDuration = 60; // Permite hasta 60s en Vercel

interface GenerateAudioRequest {
  script: string;
  episodeId?: string;
  voice?: string;
}

export async function POST(request: Request) {
  try {
    const body: GenerateAudioRequest = await request.json();
    const { script, episodeId, voice } = body;

    if (!script || script.trim().length === 0) {
      return NextResponse.json(
        { error: "El campo 'script' es requerido" },
        { status: 400 }
      );
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: "ELEVENLABS_API_KEY no está configurada en el servidor" },
        { status: 500 }
      );
    }

    const audioBuffer = await generateAudio(script, voice);

    // Subir a Supabase Storage si el usuario está autenticado y hay episodeId
    if (episodeId) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const filePath = `${user.id}/${episodeId}.mp3`;

          const { error: uploadError } = await supabase.storage
            .from("podcast-audio")
            .upload(filePath, audioBuffer, {
              contentType: "audio/mpeg",
              upsert: true,
            });

          if (!uploadError) {
            // Obtener URL pública y actualizar el episodio
            const {
              data: { publicUrl },
            } = supabase.storage
              .from("podcast-audio")
              .getPublicUrl(filePath);

            await supabase
              .from("episodes")
              .update({ audio_url: publicUrl })
              .eq("id", episodeId)
              .eq("user_id", user.id);
          }
        }
      } catch (uploadErr) {
        // No bloquear: el audio ya se generó, se devuelve igualmente
        log.warn("No se pudo subir el audio a Supabase Storage", uploadErr);
      }
    }

    return new Response(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
      },
    });
  } catch (error) {
    log.error("Error generando audio", error);

    const message =
      error instanceof Error ? error.message : "Error desconocido";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
