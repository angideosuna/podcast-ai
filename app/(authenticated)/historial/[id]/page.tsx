"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getTopicById } from "@/lib/topics";
import { renderMarkdown } from "@/lib/markdown";
import { AudioPlayer } from "@/components/audio-player";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import type { Episode } from "@/lib/types";

export default function EpisodeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const episodeId = params.id as string;

  const [episode, setEpisode] = useState<Episode | null>(null);
  const [loading, setLoading] = useState(true);

  // Estado del audio (para regenerar si no existe)
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    async function loadEpisode() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("episodes")
        .select("*")
        .eq("id", episodeId)
        .eq("user_id", user.id)
        .single();

      if (error || !data) {
        router.push("/historial");
        return;
      }

      setEpisode(data);
      if (data.audio_url) setAudioUrl(data.audio_url);
      setLoading(false);
    }

    loadEpisode();
  }, [episodeId, router]);

  const generateAudio = useCallback(async () => {
    if (!episode) return;
    setAudioLoading(true);
    setAudioError(null);

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: episode.script, episodeId: episode.id }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(
          (data as { error?: string }).error || "Error al generar el audio"
        );
      }

      const audioBlob = await response.blob();
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
    } catch (err) {
      setAudioError(
        err instanceof Error ? err.message : "No se pudo generar el audio"
      );
    } finally {
      setAudioLoading(false);
    }
  }, [episode]);

  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-60px)] items-center justify-center bg-stone-100">
        <Loader2 className="h-8 w-8 animate-spin text-stone-900" />
      </div>
    );
  }

  if (!episode) return null;

  return (
    <div className="min-h-[calc(100vh-60px)] bg-stone-100 px-4 pb-24 pt-8 text-stone-900">
      <div className="mx-auto max-w-3xl">
        {/* Volver */}
        <Link
          href="/historial"
          className="mb-6 inline-flex items-center gap-2 text-sm text-stone-500 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al historial
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">{episode.title}</h1>
          <p className="mt-1 text-sm text-stone-400">
            {new Date(episode.created_at).toLocaleDateString("es-ES", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · {episode.duration} min · {episode.tone}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {episode.topics.map((topicId) => {
              const topic = getTopicById(topicId);
              return (
                <span
                  key={topicId}
                  className="rounded-full bg-stone-800/8 px-3 py-1 text-sm text-stone-900"
                >
                  {topic ? `${topic.emoji} ${topic.nombre}` : topicId}
                </span>
              );
            })}
          </div>
        </div>

        {/* Boton de generar audio si no existe */}
        {!audioUrl && !audioLoading && !audioError && (
          <div className="mb-6 rounded-2xl border border-stone-200 bg-white p-4 text-center">
            <p className="mb-3 text-sm text-stone-500">
              Este episodio no tiene audio generado
            </p>
            <button
              onClick={generateAudio}
              className="cursor-pointer rounded-full bg-stone-900 px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              🔊 Generar audio
            </button>
          </div>
        )}

        {/* Guion */}
        <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8">
          <div
            className="prose prose-stone max-w-none"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(episode.script) }}
          />
        </div>

        {/* Fuentes */}
        {episode.articles && episode.articles.length > 0 && (
          <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold text-stone-800">
              📰 Fuentes utilizadas
            </h2>
            <ul className="space-y-3">
              {episode.articles.map((article, i) => (
                <li
                  key={i}
                  className="border-b border-stone-200 pb-3 last:border-0 last:pb-0"
                >
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <p className="font-medium text-stone-900 underline transition-colors group-hover:text-stone-700">
                      {article.title}
                    </p>
                    <p className="mt-1 text-sm text-stone-400">
                      {article.source} ·{" "}
                      {new Date(article.publishedAt).toLocaleDateString(
                        "es-ES"
                      )}
                    </p>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Audio Player */}
      <AudioPlayer
        audioUrl={audioUrl}
        isLoading={audioLoading}
        error={audioError}
        onRetry={generateAudio}
      />
    </div>
  );
}
